import { createFileRoute } from "@tanstack/react-router";
import { getPortfolioState } from "~/lib/db-portfolio";
import { requireProductAccess } from "~/lib/request-auth";
import { normalizeRadarDraft, RADAR_DISPOSITIONS, type RadarDisposition, type RadarDraft, type RadarSignalStatus } from "~/lib/radar";
import { listRadarSignals, putRadarSignal, updateRadarSignal } from "~/lib/radar.server";

async function ownsProduct(userId: number, productId?: string | null) {
  if (!productId) return true;
  const state = (await getPortfolioState(userId)) as { products?: Array<{ id?: string }> } | null;
  return !!state?.products?.some((product) => product?.id === productId);
}

async function accessUser(request: Request) {
  try { return (await requireProductAccess(request)).user; }
  catch { return null; }
}

export const Route = createFileRoute("/api/radar")({
  server: { handlers: {
    GET: async ({ request }) => {
      const user = await accessUser(request);
      return user ? Response.json({ signals: await listRadarSignals(user.id) }) : Response.json({ error: "product_access_required" }, { status: 403 });
    },
    POST: async ({ request }) => {
      const user = await accessUser(request);
      if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
      let draft: RadarDraft;
      try { draft = await request.json() as RadarDraft; } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
      if (!(await ownsProduct(user.id, draft.productId))) return Response.json({ error: "product_not_owned" }, { status: 403 });
      try {
        const signal = normalizeRadarDraft(draft);
        await putRadarSignal(user.id, signal);
        return Response.json({ signal });
      } catch (error) {
        return Response.json({ error: error instanceof Error ? error.message : "invalid_signal" }, { status: 400 });
      }
    },
    PATCH: async ({ request }) => {
      const user = await accessUser(request);
      if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
      let body: { id?: string; ownerDisposition?: RadarDisposition | null; productId?: string | null; status?: RadarSignalStatus };
      try { body = await request.json() as typeof body; } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
      const id = String(body.id ?? "").trim();
      if (!id) return Response.json({ error: "missing_id" }, { status: 400 });
      if (body.ownerDisposition && !(RADAR_DISPOSITIONS as readonly string[]).includes(body.ownerDisposition)) return Response.json({ error: "invalid_disposition" }, { status: 400 });
      if (body.status && body.status !== "active" && body.status !== "archived") return Response.json({ error: "invalid_status" }, { status: 400 });
      if (!(await ownsProduct(user.id, body.productId))) return Response.json({ error: "product_not_owned" }, { status: 403 });
      const signal = await updateRadarSignal(user.id, id, body);
      return signal ? Response.json({ signal }) : Response.json({ error: "not_found" }, { status: 404 });
    },
  } },
});
