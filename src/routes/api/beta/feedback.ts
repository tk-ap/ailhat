import { createFileRoute } from "@tanstack/react-router";
import { submitBetaFeedback } from "~/lib/access";
import { requireRequestUser } from "~/lib/request-auth";

export const Route = createFileRoute("/api/beta/feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await requireRequestUser(request);
          const body = await request.json() as {
            category?: string;
            message?: string;
            route?: string | null;
          };
          await submitBetaFeedback(user, {
            category: String(body.category ?? "observation"),
            message: String(body.message ?? ""),
            route: body.route ? String(body.route) : null,
          });
          return Response.json({ ok: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          const status = message === "not_authenticated" ? 401 : message === "Founding Beta access required." ? 403 : 400;
          return Response.json({ ok: false, error: message }, { status });
        }
      },
    },
  },
});
