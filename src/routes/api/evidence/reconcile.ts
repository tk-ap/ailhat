import { createFileRoute } from "@tanstack/react-router";
import { SESSION_COOKIE, findUserByToken, parseCookies } from "~/lib/auth";
import { getPortfolioState } from "~/lib/db-portfolio";
import { readExternalEvidenceSnapshots } from "~/lib/external-evidence.server";
import { reconcileProductEvidence } from "~/lib/evidence-reconciliation";
import type { ProductScanHistory } from "~/lib/observation";

async function requireUser(request: Request) {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE] ?? "";
  const user = token ? await findUserByToken(token) : null;
  if (!user) throw new Error("not_authenticated");
  return user;
}

function productContext(raw: unknown, productId: string): {
  product: { id: string; name?: string; url?: string };
  scanHistory: ProductScanHistory | null;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const state = raw as { products?: unknown; scanHistory?: unknown };
  if (!Array.isArray(state.products)) return null;
  const product = state.products.find(
    (item) =>
      item &&
      typeof item === "object" &&
      String((item as { id?: unknown }).id ?? "") === productId,
  ) as { id: string; name?: string; url?: string } | undefined;
  if (!product) return null;

  const histories =
    state.scanHistory && typeof state.scanHistory === "object" && !Array.isArray(state.scanHistory)
      ? (state.scanHistory as Record<string, ProductScanHistory>)
      : {};
  return { product, scanHistory: histories[productId] ?? null };
}

export const Route = createFileRoute("/api/evidence/reconcile")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        let user;
        try {
          user = await requireUser(request);
        } catch {
          return Response.json({ error: "not_authenticated" }, { status: 401 });
        }

        const url = new URL(request.url);
        const productId = (url.searchParams.get("productId") ?? "").trim();
        if (!productId) {
          return Response.json({ error: "missing_product_id" }, { status: 400 });
        }

        const portfolio = await getPortfolioState(user.id);
        const context = productContext(portfolio, productId);
        if (!context) {
          return Response.json({ error: "product_not_found" }, { status: 404 });
        }

        let snapshots;
        try {
          snapshots = await readExternalEvidenceSnapshots(user.id, productId);
        } catch {
          return Response.json(
            {
              ok: false,
              productId,
              error: "evidence_store_unavailable",
              message:
                "External evidence could not be read. ailhat cannot infer outside inactivity from this missing source state.",
            },
            { status: 503 },
          );
        }

        const observations = snapshots.flatMap((snapshot) => snapshot.observations);
        const sources = snapshots.map((snapshot) => snapshot.source);
        const reconciliation = reconcileProductEvidence({
          productId,
          observations,
          sources,
          scanHistory: context.scanHistory,
        });

        return Response.json({
          ok: true,
          product: context.product,
          reconciliation,
          sources: snapshots.map((snapshot) => ({
            provider: snapshot.provider,
            connectionRef: snapshot.connectionRef,
            fetchedAt: snapshot.fetchedAt,
            source: snapshot.source,
            observationCount: snapshot.observations.length,
          })),
        });
      },
    },
  },
});
