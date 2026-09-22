import { createFileRoute } from "@tanstack/react-router";
import { requireRequestOwner } from "~/lib/request-auth";
import {
  deleteProductSandboxEnvironment,
  getSandboxEnvironmentOverview,
  saveProductSandboxEnvironment,
} from "~/lib/sandbox-environments.server";

function statusFor(message: string) {
  if (message === "not_authenticated") return 401;
  if (message === "owner_required") return 403;
  if (message.startsWith("invalid_")) return 400;
  return 500;
}

export const Route = createFileRoute("/api/sandbox-environments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const owner = await requireRequestOwner(request);
          return Response.json(await getSandboxEnvironmentOverview(owner));
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown_error";
          return Response.json({ error: message }, { status: statusFor(message) });
        }
      },
      PUT: async ({ request }) => {
        try {
          const owner = await requireRequestOwner(request);
          const input = await request.json() as Record<string, unknown>;
          return Response.json({ environment: await saveProductSandboxEnvironment(owner, input) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown_error";
          return Response.json({ error: message }, { status: statusFor(message) });
        }
      },
      DELETE: async ({ request }) => {
        try {
          const owner = await requireRequestOwner(request);
          const productId = new URL(request.url).searchParams.get("productId") || "";
          await deleteProductSandboxEnvironment(owner, productId);
          return Response.json({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown_error";
          return Response.json({ error: message }, { status: statusFor(message) });
        }
      },
    },
  },
});
