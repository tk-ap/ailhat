import { createFileRoute } from "@tanstack/react-router";
import { getPortfolioState } from "~/lib/db-portfolio";
import { putExternalEvidenceSnapshot, readExternalEvidenceSnapshots } from "~/lib/external-evidence.server";
import { observePublicGitHubRepository, parseGitHubRepositoryUrl } from "~/lib/github-evidence";
import { requireProductAccess } from "~/lib/request-auth";

async function accessUser(request: Request) {
  try { return (await requireProductAccess(request)).user; } catch { return null; }
}
async function requireOwnedProduct(userId: number, productId: string) {
  const raw = await getPortfolioState(userId);
  const products = raw && typeof raw === "object" ? (raw as { products?: unknown }).products : null;
  if (!Array.isArray(products) || !products.some((item) => item && typeof item === "object" && String((item as { id?: unknown }).id ?? "") === productId)) throw new Error("product_not_found");
}

export const Route = createFileRoute("/api/evidence/github")({
  server: { handlers: {
    GET: async ({ request }) => {
      const user = await accessUser(request);
      if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
      const productId = (new URL(request.url).searchParams.get("productId") ?? "").trim();
      if (!productId) return Response.json({ error: "missing_product_id" }, { status: 400 });
      try { await requireOwnedProduct(user.id, productId); } catch { return Response.json({ error: "product_not_found" }, { status: 404 }); }
      try { return Response.json({ ok: true, productId, snapshots: await readExternalEvidenceSnapshots(user.id, productId, "github") }); }
      catch { return Response.json({ ok: false, productId, snapshots: [], error: "evidence_store_unavailable" }, { status: 503 }); }
    },
    POST: async ({ request }) => {
      const user = await accessUser(request);
      if (!user) return Response.json({ error: "product_access_required" }, { status: 403 });
      let body: { productId?: string; repositoryUrl?: string };
      try { body = await request.json() as typeof body; } catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
      const productId = String(body.productId ?? "").trim();
      const repositoryUrl = String(body.repositoryUrl ?? "").trim();
      if (!productId || !repositoryUrl) return Response.json({ error: "product_id_and_repository_url_required" }, { status: 400 });
      if (!parseGitHubRepositoryUrl(repositoryUrl)) return Response.json({ error: "invalid_github_repository_url", message: "Use a canonical public repository URL such as https://github.com/owner/repo." }, { status: 400 });
      try { await requireOwnedProduct(user.id, productId); } catch { return Response.json({ error: "product_not_found" }, { status: 404 }); }
      const result = await observePublicGitHubRepository(productId, repositoryUrl);
      try {
        await putExternalEvidenceSnapshot(user.id, { productId, provider: "github", connectionRef: result.repository.url, identity: result.repository, source: result.source, observations: result.observations, fetchedAt: result.fetchedAt });
      } catch {
        return Response.json({ ok: false, result, error: "evidence_store_unavailable", message: "GitHub was observed, but the evidence snapshot was not persisted." }, { status: 503 });
      }
      return Response.json({ ok: true, result, message: result.availability === "connected" ? "Public GitHub repository evidence observed and stored. Repository activity is not proof of deployment or resolution." : "The repository source is unavailable; ailhat preserved that as unknown/unavailable rather than no activity." });
    },
  } },
});
