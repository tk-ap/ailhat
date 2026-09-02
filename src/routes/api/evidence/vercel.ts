import { createFileRoute } from "@tanstack/react-router";
import { SESSION_COOKIE, findUserByToken, parseCookies } from "~/lib/auth";
import { getPortfolioState } from "~/lib/db-portfolio";
import {
  putExternalEvidenceSnapshot,
  readExternalEvidenceSnapshots,
} from "~/lib/external-evidence.server";
import { observeVercelProject } from "~/lib/vercel-evidence";

async function requireUser(request: Request) {
  const token = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE] ?? "";
  const user = token ? await findUserByToken(token) : null;
  if (!user) throw new Error("not_authenticated");
  return user;
}

async function requireOwnedProduct(userId: number, productId: string) {
  const raw = await getPortfolioState(userId);
  if (!raw || typeof raw !== "object") throw new Error("product_not_found");
  const products = (raw as { products?: unknown }).products;
  if (!Array.isArray(products)) throw new Error("product_not_found");
  const product = products.find(
    (item) =>
      item &&
      typeof item === "object" &&
      String((item as { id?: unknown }).id ?? "") === productId,
  ) as { id?: string; url?: string; name?: string } | undefined;
  if (!product) throw new Error("product_not_found");
  return product;
}

function vercelToken(): string | undefined {
  return (
    process.env.VERCEL_API_TOKEN?.trim() ||
    process.env.VERCEL_TOKEN?.trim() ||
    undefined
  );
}

function vercelTeamId(): string | undefined {
  return process.env.VERCEL_TEAM_ID?.trim() || undefined;
}

export const Route = createFileRoute("/api/evidence/vercel")({
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

        try {
          await requireOwnedProduct(user.id, productId);
        } catch {
          return Response.json({ error: "product_not_found" }, { status: 404 });
        }

        try {
          const snapshots = await readExternalEvidenceSnapshots(
            user.id,
            productId,
            "vercel",
          );
          return Response.json({ ok: true, productId, snapshots });
        } catch {
          return Response.json(
            {
              ok: false,
              productId,
              snapshots: [],
              error: "evidence_store_unavailable",
            },
            { status: 503 },
          );
        }
      },

      POST: async ({ request }) => {
        let user;
        try {
          user = await requireUser(request);
        } catch {
          return Response.json({ error: "not_authenticated" }, { status: 401 });
        }

        let body: { productId?: string; projectRef?: string };
        try {
          body = (await request.json()) as {
            productId?: string;
            projectRef?: string;
          };
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }

        const productId = String(body.productId ?? "").trim();
        const projectRef = String(body.projectRef ?? "").trim();
        if (!productId || !projectRef) {
          return Response.json(
            { error: "product_id_and_project_ref_required" },
            { status: 400 },
          );
        }

        let product: { id?: string; url?: string; name?: string };
        try {
          product = await requireOwnedProduct(user.id, productId);
        } catch {
          return Response.json({ error: "product_not_found" }, { status: 404 });
        }

        const productUrl = String(product.url ?? "").trim();
        if (!productUrl) {
          return Response.json(
            {
              error: "product_url_required",
              message:
                "A production URL is required before ailhat can validate a Vercel project against the live product.",
            },
            { status: 400 },
          );
        }

        const result = await observeVercelProject(
          productId,
          productUrl,
          projectRef,
          vercelToken(),
          vercelTeamId(),
        );

        try {
          await putExternalEvidenceSnapshot(user.id, {
            productId,
            provider: "vercel",
            connectionRef: projectRef,
            identity: result.deployment,
            source: result.source,
            observations: result.observations,
            fetchedAt: result.fetchedAt,
          });
        } catch {
          return Response.json(
            {
              ok: false,
              result,
              error: "evidence_store_unavailable",
              message:
                "Vercel observation completed, but ailhat could not persist the evidence snapshot. Do not treat it as durable evidence yet.",
            },
            { status: 503 },
          );
        }

        return Response.json({
          ok: true,
          result,
          message:
            result.availability === "connected"
              ? "Vercel production deployment evidence observed and stored. A Ready deployment proves release state, not resolution of the original product condition."
              : result.reason ??
                "Vercel evidence is unavailable. ailhat preserved that source state instead of inferring no deployment activity.",
        });
      },
    },
  },
});
