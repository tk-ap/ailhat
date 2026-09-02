import { createFileRoute } from "@tanstack/react-router";
import { revokeFoundingBeta } from "~/lib/access.server";
import { requireRequestOwner } from "~/lib/request-auth";

export const Route = createFileRoute("/api/owner/revoke")({
  server: { handlers: { POST: async ({ request }) => {
    let owner;
    try { owner = await requireRequestOwner(request); }
    catch { return Response.json({ ok: false, error: "owner_required" }, { status: 403 }); }
    let body: { userId?: number };
    try { body = await request.json() as typeof body; }
    catch { return Response.json({ ok: false, error: "invalid_request" }, { status: 400 }); }
    const userId = Number(body.userId ?? 0);
    if (!Number.isFinite(userId) || userId <= 0) return Response.json({ ok: false, error: "invalid_user" }, { status: 400 });
    await revokeFoundingBeta(owner, userId);
    return Response.json({ ok: true });
  } } },
});
