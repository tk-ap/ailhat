import { useEffect, useMemo, useState } from "react";
import type { ExternalObservation, ProductRepositoryIdentity } from "~/lib/external-evidence";

type ProductOption = { id: string; name: string };

interface StoredSnapshot {
  productId: string;
  provider: "github";
  connectionRef: string;
  identity: ProductRepositoryIdentity;
  source: {
    provider: "github";
    availability: "connected" | "unknown" | "unavailable";
    reason?: string;
  };
  observations: ExternalObservation[];
  fetchedAt: number;
}

interface ObserveResult {
  productId: string;
  repository: ProductRepositoryIdentity;
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

export default function PublicGitHubEvidenceConnector({
  products,
}: {
  products: ProductOption[];
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState("");
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
          `/api/evidence/github?productId=${encodeURIComponent(productId)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { snapshots?: StoredSnapshot[] };
        if (cancelled) return;
        const next = Array.isArray(data.snapshots) ? data.snapshots : [];
        setSnapshots(next);
        const first = next[0];
        if (first?.identity?.url) setRepositoryUrl(first.identity.url);
      } catch {
        // Preserve the last rendered evidence state when the read is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const latest = snapshots[0] ?? null;
  const latestObservation = useMemo(() => {
    const all = snapshots.flatMap((snapshot) => snapshot.observations ?? []);
    return all.sort((a, b) => b.observedAt - a.observedAt)[0] ?? null;
  }, [snapshots]);

  const observe = async () => {
    if (!productId || !repositoryUrl.trim() || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/evidence/github", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, repositoryUrl: repositoryUrl.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        result?: ObserveResult;
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.result) {
        setMessage(data.message ?? data.error ?? "GitHub evidence could not be observed.");
        return;
      }
      const result = data.result;
      const snapshot: StoredSnapshot = {
        productId: result.productId,
        provider: "github",
        connectionRef: result.repository.url,
        identity: result.repository,
        source: result.source,
        observations: result.observations,
        fetchedAt: result.fetchedAt,
      };
      setSnapshots((current) => [
        snapshot,
        ...current.filter((item) => item.connectionRef !== snapshot.connectionRef),
      ]);
      setRepositoryUrl(result.repository.url);
      setMessage(data.message ?? "GitHub evidence observed.");
    } catch {
      setMessage(
        "GitHub evidence is currently unreachable. ailhat cannot infer inactivity from this missing observation.",
      );
    } finally {
      setLoading(false);
    }
  };

  const connected = latest?.source?.availability === "connected";

  return (
    <section className="silhat-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="silhat-eyebrow">Repository context · read only</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-100">Public GitHub evidence</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Link a public repository as secondary product context. Commits, pull requests, and issue state can show implementation activity; production still decides what users can experience, and verification decides whether a finding is resolved.
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
        <p className="mt-4 text-sm text-gray-500">Add a product before linking repository evidence.</p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto] lg:items-end">
          <label className="text-sm text-gray-400">
            Product
            <select
              value={productId}
              onChange={(event) => {
                setProductId(event.target.value);
                setRepositoryUrl("");
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
            Public GitHub repository
            <input
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder="https://github.com/owner/repo"
              inputMode="url"
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200 outline-none focus:border-[#7fb0ff]"
            />
          </label>
          <button
            type="button"
            disabled={!productId || !repositoryUrl.trim() || loading}
            onClick={() => void observe()}
            className="silhat-btn silhat-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Observing…" : latest ? "Refresh evidence" : "Link & observe"}
          </button>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <p className="text-xs text-gray-500">Repository</p>
          <p className="mt-1 truncate text-sm font-semibold text-gray-200">
            {latest?.identity?.owner && latest.identity.name
              ? `${latest.identity.owner}/${latest.identity.name}`
              : "Not observed"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <p className="text-xs text-gray-500">Evidence rows</p>
          <p className="mt-1 text-sm font-semibold text-gray-200">
            {latest?.observations?.length ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
          <p className="text-xs text-gray-500">Latest repository evidence</p>
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
        Current scope: public GitHub repositories, read only, manually refreshed. Private-repository authorization and webhook monitoring are not connected yet.
      </p>
    </section>
  );
}
