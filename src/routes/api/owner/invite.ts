import { createFileRoute } from "@tanstack/react-router";
import { createFoundingBetaInvite } from "~/lib/access";
import { requireRequestOwner } from "~/lib/request-auth";

export const Route = createFileRoute("/api/owner/invite")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const owner = await requireRequestOwner(request);
          if (process.env.AILHAT_BETA_INVITES_ENABLED !== "true") {
            return Response.json(
              {
                ok: false,
                error:
                  "Founding Beta invitations are staged but disabled until ailhat's remaining single-owner intelligence paths are tenant-scoped.",
              },
              { status: 409 },
            );
          }
          const body = await request.json() as { email?: string; accessDays?: number };
          const requestedAccessDays = Number(body.accessDays ?? 45);
          const safeAccessDays = Number.isFinite(requestedAccessDays) ? requestedAccessDays : 45;
          const invite = await createFoundingBetaInvite(
            owner,
            String(body.email ?? ""),
            safeAccessDays,
          );
          return Response.json({ ok: true, invite });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          const status = message === "not_authenticated" ? 401 : message === "owner_required" ? 403 : 400;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
