import { createFileRoute } from "@tanstack/react-router";
import { SESSION_COOKIE, findUserByToken, parseCookies } from "~/lib/auth";
import { getPortfolioState } from "~/lib/db-portfolio";
import {
  putExternalEvidenceSnapshot,
  readExternalEvidenceSnapshots,
} from "~/lib/external-evidence.server";
import {
  observePublicGitHubRepository,
  parseGitHubRepositoryUrl,
} from "~/lib/github-evidence";

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
  );
  if (!product) throw new Error("product_not_found");
  return product;
}

export const Route = createFileRoute("/api/evidence/github")({
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
            "github",
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

        let body: { productId?: string; repositoryUrl?: string };
        try {
          body = (await request.json()) as {
            productId?: string;
            repositoryUrl?: string;
          };
        } catch {
          return Response.json({ error: "invalid_request" }, { status: 400 });
        }

        const productId = String(body.productId ?? "").trim();
        const repositoryUrl = String(body.repositoryUrl ?? "").trim();
        if (!productId || !repositoryUrl) {
          return Response.json(
            { error: "product_id_and_repository_url_required" },
            { status: 400 },
          );
        }
        if (!parseGitHubRepositoryUrl(repositoryUrl)) {
          return Response.json(
            {
              error: "invalid_github_repository_url",
              message:
                "Use a canonical public repository URL such as https://github.com/owner/repo.",
            },
            { status: 400 },
          );
        }

        try {
          await requireOwnedProduct(user.id, productId);
        } catch {
          return Response.json({ error: "product_not_found" }, { status: 404 });
        }

        const result = await observePublicGitHubRepository(
          productId,
          repositoryUrl,
        );

        try {
          await putExternalEvidenceSnapshot(user.id, {
            productId,
            provider: "github",
            connectionRef: result.repository.url,
            identity: result.repository,
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
                "GitHub was observed, but ailhat could not persist this evidence snapshot. Do not treat it as durable evidence yet.",
            },
            { status: 503 },
          );
        }

        return Response.json({
          ok: true,
          result,
          message:
            result.availability === "connected"
              ? "Public GitHub repository evidence observed and stored. Repository activity is implementation context, not proof of deployment or resolution."
              : "The repository source is currently unavailable. ailhat stored that source state as unknown/unavailable rather than treating it as no activity.",
        });
      },
    },
  },
});
