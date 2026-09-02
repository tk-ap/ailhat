import { createFileRoute } from "@tanstack/react-router";
import { getOwnerOverview } from "~/lib/access.server";
import { requireRequestOwner } from "~/lib/request-auth";

export const Route = createFileRoute("/api/owner/overview")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      const owner = await requireRequestOwner(request);
      return Response.json({ overview: await getOwnerOverview(owner) });
    } catch {
      return Response.json({ error: "owner_required" }, { status: 403 });
    }
  } } },
});
