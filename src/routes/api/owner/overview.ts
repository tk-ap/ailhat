import { createFileRoute } from "@tanstack/react-router";
import { getOwnerOverview } from "~/lib/access.server";
import { requireRequestOwner } from "~/lib/request-auth";
import { getWorkspaceEnvironmentProjection } from "~/lib/workspace-environments.server";

export const Route = createFileRoute("/api/owner/overview")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      const owner = await requireRequestOwner(request);
      const [overview, workspaceEnvironmentProjection] = await Promise.all([
        getOwnerOverview(owner),
        getWorkspaceEnvironmentProjection(),
      ]);
      return Response.json({
        overview: {
          ...overview,
          workspaceEnvironments: workspaceEnvironmentProjection.environments,
          workspaceEnvironmentStatus: {
            available: workspaceEnvironmentProjection.available,
            source: workspaceEnvironmentProjection.source,
            observedAt: workspaceEnvironmentProjection.observedAt,
            error: workspaceEnvironmentProjection.error,
          },
        },
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "owner_required" }, { status: 403 });
    }
  } } },
});
