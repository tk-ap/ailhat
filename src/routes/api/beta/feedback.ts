import { createFileRoute } from "@tanstack/react-router";
import { submitBetaFeedback } from "~/lib/access.server";
import { requireProductAccess } from "~/lib/request-auth";

export const Route = createFileRoute("/api/beta/feedback")({
  server: { handlers: { POST: async ({ request }) => {
    let user;
    try { ({ user } = await requireProductAccess(request)); }
    catch { return Response.json({ ok: false, error: "Founding Beta or owner access required." }, { status: 403 }); }
    let body: { category?: string; message?: string; route?: string };
    try { body = await request.json() as typeof body; }
    catch { return Response.json({ ok: false, error: "Invalid request body." }, { status: 400 }); }
    try {
      await submitBetaFeedback(user, {
        category: String(body.category ?? "observation"),
        message: String(body.message ?? ""),
        route: body.route ? String(body.route) : null,
      });
      return Response.json({ ok: true });
    } catch (error) {
      return Response.json({ ok: false, error: error instanceof Error ? error.message : "feedback_failed" }, { status: 400 });
    }
  } } },
});
