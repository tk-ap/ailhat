import { createFileRoute } from "@tanstack/react-router";
import { getOwnerOverview } from "~/lib/access";
import { requireRequestOwner } from "~/lib/request-auth";

export const Route = createFileRoute("/api/owner/overview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const owner = await requireRequestOwner(request);
          return Response.json({ overview: await getOwnerOverview(owner) });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          const status = message === "not_authenticated" ? 401 : message === "owner_required" ? 403 : 503;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
