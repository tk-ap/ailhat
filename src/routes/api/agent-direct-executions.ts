import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { requireProductAccess } from "~/lib/request-auth";
import {
  claimNextSandboxExecution,
  createSandboxExecution,
  getSandboxExecutionOverview,
  updateSandboxExecutionFromRuntime,
} from "~/lib/sandbox-execution.server";

function machineAuthorized(request: Request): boolean {
  const expected = process.env.AILHAT_AGENTOS_SYNC_TOKEN?.trim() || "";
  const header = request.headers.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

function statusFor(message: string) {
  if (message === "not_authenticated") return 401;
  if (message === "product_access_required") return 403;
  if (message === "product_not_found" || message === "execution_not_found") return 404;
  if (message === "execution_backend_unconfigured" || message === "sandbox_not_ready") return 409;
  if (
    message === "product_id_required" ||
    message === "invalid_work_item" ||
    message === "work_item_product_mismatch" ||
    message === "invalid_runtime_update" ||
    message === "stale_execution_claim"
  ) return 400;
  return 500;
}

export const Route = createFileRoute("/api/agent-direct-executions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("view") === "next") {
          if (!machineAuthorized(request)) return Response.json({ error: "machine_unauthorized" }, { status: 401 });
          try {
            return Response.json({ ok: true, execution: await claimNextSandboxExecution() });
          } catch {
            return Response.json({ ok: false, error: "execution_queue_unavailable" }, { status: 503 });
          }
        }

        try {
          const { user } = await requireProductAccess(request);
          const productId = (url.searchParams.get("productId") || "").trim();
          if (!productId) return Response.json({ error: "product_id_required" }, { status: 400 });
          return Response.json(await getSandboxExecutionOverview(user, productId));
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown_error";
          return Response.json({ error: message }, { status: statusFor(message) });
        }
      },

      POST: async ({ request }) => {
        let body: Record<string, unknown>;
        try { body = await request.json() as Record<string, unknown>; }
        catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }

        if (body.action === "runtime_update") {
          if (!machineAuthorized(request)) return Response.json({ error: "machine_unauthorized" }, { status: 401 });
          try {
            return Response.json({ ok: true, execution: await updateSandboxExecutionFromRuntime(body) });
          } catch (error) {
            const message = error instanceof Error ? error.message : "unknown_error";
            return Response.json({ error: message }, { status: statusFor(message) });
          }
        }

        try {
          const { user } = await requireProductAccess(request);
          const execution = await createSandboxExecution(user, body);
          return Response.json({ ok: true, execution }, { status: 201 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown_error";
          return Response.json({ error: message }, { status: statusFor(message) });
        }
      },
    },
  },
});
