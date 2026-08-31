import { createFileRoute } from "@tanstack/react-router";
import { getAccountAccess } from "~/lib/access";
import { requireRequestUser } from "~/lib/request-auth";

export const Route = createFileRoute("/api/access")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await requireRequestUser(request);
          const access = await getAccountAccess(user);
          return Response.json({ user, access });
        } catch (error) {
          const message = error instanceof Error ? error.message : "unknown";
          const status = message === "not_authenticated" ? 401 : 503;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});
