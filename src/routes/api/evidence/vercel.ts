import { createFileRoute } from "@tanstack/react-router";
import { getPortfolioState } from "~/lib/db-portfolio";
import { putExternalEvidenceSnapshot, readExternalEvidenceSnapshots } from "~/lib/external-evidence.server";
import { requireProductAccess } from "~/lib/request-auth";
import { observeVercelProject } from "~/lib/vercel-evidence";

async function accessUser(request: Request) { try { return (await requireProductAccess(request)).user; } catch { return null; } }
async function requireOwnedProduct(userId: number, productId: string) {
  const raw = await getPortfolioState(userId);
  const products = raw && typeof raw === "object" ? (raw as { products?: unknown }).products : null;
  if (!Array.isArray(products)) throw new Error("product_not_found");
  const product = products.find((item) => item && typeof item === "object" && String((item as { id?: unknown }).id ?? "") === productId) as { id?: string; url?: string; name?: string } | undefined;
  if (!product) throw new Error("product_not_found");
  return product;
}
const vercelToken = () => process.env.VERCEL_API_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim() || undefined;
const vercelTeamId = () => process.env.VERCEL_TEAM_ID?.trim() || undefined;

export const Route = createFileRoute("/api/evidence/vercel")({ server: { handlers: {
  GET: async ({ request }) => {
    const user = await accessUser(request);
    if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
    const productId = (new URL(request.url).searchParams.get("productId") ?? "").trim();
    if (!productId) return Response.json({ error: "missing_product_id" }, { status: 400 });
    try { await requireOwnedProduct(user.id, productId); } catch { return Response.json({ error: "product_not_found" }, { status: 404 }); }
    try { return Response.json({ ok: true, productId, snapshots: await readExternalEvidenceSnapshots(user.id, productId, "vercel") }); }
    catch { return Response.json({ ok: false, productId, snapshots: [], error: "evidence_store_unavailable" }, { status: 503 }); }
  },
  POST: async ({ request }) => {
    const user = await accessUser(request);
    if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
    let body: { productId?: string; projectRef?: string };
    try { body = await request.json() as typeof body; } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
    const productId = String(body.productId ?? "").trim();
    const projectRef = String(body.projectRef ?? "").trim();
    if (!productId || !projectRef) return Response.json({ error: "product_id_and_project_ref_required" }, { status: 400 });
    let product: { id?: string; url?: string; name?: string };
    try { product = await requireOwnedProduct(user.id, productId); } catch { return Response.json({ error: "product_not_found" }, { status: 404 }); }
    const productUrl = String(product.url ?? "").trim();
    if (!productUrl) return Response.json({ error: "product_url_required", message: "A production URL is required before ailhat can validate a Vercel project against the live product." }, { status: 400 });
    const result = await observeVercelProject(productId, productUrl, projectRef, vercelToken(), vercelTeamId());
    try { await putExternalEvidenceSnapshot(user.id, { productId, provider: "vercel", connectionRef: projectRef, identity: result.deployment, source: result.source, observations: result.observations, fetchedAt: result.fetchedAt }); }
    catch { return Response.json({ ok: false, result, error: "evidence_store_unavailable", message: "Vercel observation completed, but the evidence snapshot was not persisted." }, { status: 503 }); }
    return Response.json({ ok: true, result, message: result.availability === "connected" ? "Vercel production deployment evidence observed and stored. Ready proves release state, not product resolution." : result.reason ?? "Vercel evidence is unavailable; ailhat preserved that source state instead of inferring no deployment activity." });
  },
} } });
