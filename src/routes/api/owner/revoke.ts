import { createFileRoute } from "@tanstack/react-router";
import { revokeFoundingBeta } from "~/lib/access";
import { requireRequestOwner } from "~/lib/request-auth";

export const Route = createFileRoute("/api/owner/revoke")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const owner = await requireRequestOwner(request);
          const body = await request.json() as { userId?: number };
          const userId = Number(body.userId);
          if (!Number.isInteger(userId) || userId <= 0) {
            return Response.json({ ok: false, error: "A valid userId is required." }, { status: 400 });
          }
          await revokeFoundingBeta(owner, userId);
          return Response.json({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          const status = message === "not_authenticated" ? 401 : message === "owner_required" ? 403 : 503;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
