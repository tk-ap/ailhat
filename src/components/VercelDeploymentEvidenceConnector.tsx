import { useEffect, useMemo, useState } from "react";
import type { ExternalObservation, ProductDeploymentIdentity } from "~/lib/external-evidence";
import EvidenceReconciliationPanel from "~/components/EvidenceReconciliationPanel";

type ProductOption = { id: string; name: string; url: string };

interface StoredSnapshot {
  productId: string;
  provider: "vercel";
  connectionRef: string;
  identity: ProductDeploymentIdentity;
  source: {
    provider: "vercel";
    availability: "connected" | "unknown" | "unavailable";
    reason?: string;
  };
  observations: ExternalObservation[];
  fetchedAt: number;
}

interface ObserveResult {
  productId: string;
  deployment: ProductDeploymentIdentity;
  source: StoredSnapshot["source"];
  observations: ExternalObservation[];
  fetchedAt: number;
  availability: "connected" | "unavailable";
  reason?: string;
}

function ageLabel(at?: number | null) {
  if (!at) return "No observation yet";
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function VercelDeploymentEvidenceConnector({
  products,
}: {
  products: ProductOption[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [projectRef, setProjectRef] = useState("");
  const [snapshots, setSnapshots] = useState<StoredSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!productId && products[0]?.id) setProductId(products[0].id);
  }, [productId, products]);

  useEffect(() => {
    if (!productId) {
      setSnapshots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/evidence/vercel?productId=${encodeURIComponent(productId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { snapshots?: StoredSnapshot[] };
        if (cancelled) return;
        const next = Array.isArray(data.snapshots) ? data.snapshots : [];
        setSnapshots(next);
        const first = next[0];
        if (first?.identity?.projectRef) setProjectRef(first.identity.projectRef);
      } catch {
        // Keep any previously rendered evidence instead of inventing a negative state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const selectedProduct = products.find((product) => product.id === productId);
  const latest = snapshots[0] ?? null;
  const latestObservation = useMemo(() => {
    const all = snapshots.flatMap((snapshot) => snapshot.observations ?? []);
    return all.sort((a, b) => b.observedAt - a.observedAt)[0] ?? null;
  }, [snapshots]);

  const observe = async () => {
    if (!productId || !projectRef.trim() || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/evidence/vercel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, projectRef: projectRef.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        result?: ObserveResult;
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.result) {
        setMessage(data.message ?? data.error ?? "Vercel evidence could not be observed.");
        return;
      }
      const result = data.result;
      const snapshot: StoredSnapshot = {
        productId: result.productId,
        provider: "vercel",
        connectionRef: result.deployment.projectRef,
        identity: result.deployment,
        source: result.source,
        observations: result.observations,
        fetchedAt: result.fetchedAt,
      };
      setSnapshots((current) => [
        snapshot,
        ...current.filter((item) => item.connectionRef !== snapshot.connectionRef),
      ]);
      setProjectRef(result.deployment.projectRef);
      setMessage(data.message ?? "Vercel deployment evidence observed.");
    } catch {
      setMessage(
        "Vercel evidence is currently unreachable. ailhat cannot infer that no deployment occurred.",
      );
    } finally {
      setLoading(false);
    }
  };

  const connected = latest?.source?.availability === "connected";
  const readyDeployments = latest?.observations?.filter((row) => row.state === "ready").length ?? 0;

  return (
    <>
      <section className="silhat-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="silhat-eyebrow">Deployment context · read only</p>
            <h2 className="mt-1 text-xl font-semibold text-gray-100">Vercel deployment evidence</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
              Observe production deployment state only after the Vercel project's production domains match the product URL stored in ailhat. A Ready deployment proves a revision shipped; it does not verify that an original product finding is resolved.
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
              connected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-400/25 bg-amber-400/[0.05] text-amber-300"
            }`}
          >
            {connected ? "Observed" : latest ? "Unavailable / unknown" : "Not linked"}
          </span>
        </div>

        {products.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">Add a product before linking deployment evidence.</p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] lg:items-end">
            <label className="text-sm text-gray-400">
              Product
              <select
                value={productId}
                onChange={(event) => {
                  setProductId(event.target.value);
                  setProjectRef("");
                  setMessage("");
                }}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200"
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-400">
              Vercel project ID or name
              <input
                value={projectRef}
                onChange={(event) => setProjectRef(event.target.value)}
                placeholder="ailhat or prj_..."
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200 outline-none focus:border-[#7fb0ff]"
              />
            </label>
            <button
              type="button"
              disabled={!productId || !projectRef.trim() || loading || !selectedProduct?.url}
              onClick={() => void observe()}
              className="silhat-btn silhat-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Observing…" : latest ? "Refresh evidence" : "Link & observe"}
            </button>
          </div>
        )}

        {selectedProduct && !selectedProduct.url && (
          <p className="mt-3 text-xs text-amber-200/80">
            Add a production URL to this product before linking Vercel; ailhat needs the live hostname to validate the project boundary.
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <p className="text-xs text-gray-500">Project</p>
            <p className="mt-1 truncate text-sm font-semibold text-gray-200">
              {latest?.identity?.projectRef ?? "Not observed"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <p className="text-xs text-gray-500">Ready deployments</p>
            <p className="mt-1 text-sm font-semibold text-gray-200">{readyDeployments}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <p className="text-xs text-gray-500">Latest deployment evidence</p>
            <p className="mt-1 text-sm font-semibold text-gray-200">
              {ageLabel(latestObservation?.observedAt ?? latest?.fetchedAt)}
            </p>
          </div>
        </div>

        {latest?.source?.reason && (
          <p className="mt-3 text-xs leading-5 text-amber-200/80">{latest.source.reason}</p>
        )}
        {message && (
          <p className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs leading-5 text-gray-300">
            {message}
          </p>
        )}

        <p className="mt-4 text-xs leading-5 text-gray-600">
          Current scope: read-only production deployments through a server-side Vercel credential when configured. Project/domain validation is mandatory. User OAuth and webhook monitoring are not connected yet.
        </p>
      </section>

      <EvidenceReconciliationPanel products={products} />
    </>
  );
}
