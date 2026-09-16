import { createFileRoute } from "@tanstack/react-router";
import { requireRequestOwner } from "~/lib/request-auth";
import {
  getSandboxCredentialMetadata,
  revokeSandboxCredential,
  saveSandboxCredential,
} from "~/lib/sandbox-credentials.server";

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : "unknown_error";
  const status =
    message === "not_authenticated" ? 401 :
    message === "owner_required" ? 403 :
    message === "sandbox_secret_store_unavailable" || message === "invalid_sandbox_encryption_key" ? 503 :
    message === "invalid_product_id" ||
    message === "invalid_sandbox_url" ||
    message === "invalid_username" ||
    message === "invalid_password" ||
    message === "invalid_account_scope" ||
    message === "password_required" ? 400 : 500;

  const publicMessage =
    message === "sandbox_secret_store_unavailable"
      ? "Credential encryption is not configured on this deployment."
      : message === "invalid_sandbox_encryption_key"
        ? "Credential encryption is misconfigured on this deployment."
        : message === "owner_required"
          ? "Sandbox credentials are owner-only in the current release."
          : message;

  return Response.json({ ok: false, error: publicMessage }, { status });
}

export const Route = createFileRoute("/api/sandbox-credentials")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireRequestOwner(request);
          const productId = new URL(request.url).searchParams.get("productId") ?? "";
          const credential = await getSandboxCredentialMetadata(user.id, productId);
          return Response.json({ ok: true, credential }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          return errorResponse(error);
        }
      },
      PUT: async ({ request }) => {
        try {
          const user = await requireRequestOwner(request);
          const body = await request.json() as Record<string, unknown>;
          const credential = await saveSandboxCredential({
            userId: user.id,
            productId: String(body.productId ?? ""),
            sandboxUrl: String(body.sandboxUrl ?? ""),
            username: String(body.username ?? ""),
            password: typeof body.password === "string" ? body.password : undefined,
            accountScope: typeof body.accountScope === "string" ? body.accountScope : undefined,
          });
          return Response.json({ ok: true, credential }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          return errorResponse(error);
        }
      },
      DELETE: async ({ request }) => {
        try {
          const user = await requireRequestOwner(request);
          const productId = new URL(request.url).searchParams.get("productId") ?? "";
          await revokeSandboxCredential(user.id, productId);
          return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});
