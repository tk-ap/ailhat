import { createFileRoute } from "@tanstack/react-router";
import { getAccountAccess } from "~/lib/access.server";
import { requireRequestUser } from "~/lib/request-auth";

export const Route = createFileRoute("/api/access")({
  server: { handlers: { GET: async ({ request }) => {
    try {
      const user = await requireRequestUser(request);
      return Response.json({ access: await getAccountAccess(user) });
    } catch {
      return Response.json({ error: "not_authenticated" }, { status: 401 });
    }
  } } },
});
