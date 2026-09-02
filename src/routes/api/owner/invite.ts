import { createFileRoute } from "@tanstack/react-router";
import { createFoundingBetaInvite } from "~/lib/access.server";
import { requireRequestOwner } from "~/lib/request-auth";

export const Route = createFileRoute("/api/owner/invite")({
  server: { handlers: { POST: async ({ request }) => {
    let owner;
    try { owner = await requireRequestOwner(request); }
    catch { return Response.json({ ok: false, error: "owner_required" }, { status: 403 }); }
    let body: { email?: string; accessDays?: number; inviteDays?: number };
    try { body = await request.json() as typeof body; }
    catch { return Response.json({ ok: false, error: "invalid_request" }, { status: 400 }); }
    try {
      const invite = await createFoundingBetaInvite(owner, String(body.email ?? ""), Number(body.accessDays ?? 45), Number(body.inviteDays ?? 7));
      return Response.json({ ok: true, invite });
    } catch (error) {
      const code = error instanceof Error ? error.message : "invite_failed";
      return Response.json({ ok: false, error: code }, { status: code === "beta_invites_disabled" ? 409 : 400 });
    }
  } } },
});
