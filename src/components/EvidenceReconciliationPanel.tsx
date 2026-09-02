import { useEffect, useState } from "react";
import { scanSite } from "~/lib/scanClient";
import { useStore } from "~/lib/useStore";
import type { ProductEvidenceReconciliation } from "~/lib/evidence-reconciliation";

type ProductOption = { id: string; name: string; url: string };

interface ReconcileResponse {
  ok?: boolean;
  reconciliation?: ProductEvidenceReconciliation;
  sources?: Array<{
    provider: string;
    connectionRef: string;
    fetchedAt: number;
    observationCount: number;
    source: { availability: string; reason?: string };
  }>;
  message?: string;
  error?: string;
}

function ageLabel(at?: number | null) {
  if (!at) return "unknown";
  const minutes = Math.max(0, Math.floor((Date.now() - at) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function stateLabel(state?: ProductEvidenceReconciliation["state"]) {
  switch (state) {
    case "verification_pending":
      return "Verify production";
    case "verified_current":
      return "Current production verified";
    case "persisting_after_change":
      return "Findings persist after change";
    case "external_change_observed":
      return "Outside change observed";
    case "observed_no_change":
      return "Sources observed";
    default:
      return "Evidence incomplete";
  }
}

export default function EvidenceReconciliationPanel({
  products,
}: {
  products: ProductOption[];
}) {
  const { actions } = useStore();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [data, setData] = useState<ReconcileResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!productId && products[0]?.id) setProductId(products[0].id);
  }, [productId, products]);

  const refresh = async () => {
    if (!productId || loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/evidence/reconcile?productId=${encodeURIComponent(productId)}`,
        { cache: "no-store" },
      );
      const next = (await response.json().catch(() => ({}))) as ReconcileResponse;
      setData(next);
      if (!response.ok) {
        setMessage(
          next.message ??
            next.error ??
            "Cross-source evidence is currently unavailable; outside state remains unknown.",
        );
      }
    } catch {
      setMessage(
        "Cross-source evidence is currently unavailable; ailhat will not infer outside inactivity from the missing result.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData(null);
    setMessage("");
    if (productId) void refresh();
    // refresh is intentionally driven by product selection, not every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const product = products.find((item) => item.id === productId);
  const reconciliation = data?.reconciliation;

  const verify = async () => {
    if (!product?.url || verifying) return;
    setVerifying(true);
    setMessage("");
    try {
      const result = await scanSite(product.url);
      if (!result) {
        setMessage(
          "Production verification is unavailable. Existing external evidence was preserved and remains unverified.",
        );
        return;
      }
      actions.recordScan(product.id, result);
      setMessage(
        result.ok
          ? "Fresh production evidence recorded. ailhat is reconciling it against the outside change evidence."
          : "Production could not be fully verified. External change evidence remains preserved without a resolution claim.",
      );
      window.setTimeout(() => void refresh(), 1200);
    } finally {
      setVerifying(false);
    }
  };

  const statusClass = reconciliation?.state === "verified_current"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
    : reconciliation?.verificationRecommended
      ? "border-[#7fb0ff]/30 bg-[#7fb0ff]/10 text-[#9cc8ff]"
      : reconciliation?.state === "persisting_after_change"
        ? "border-amber-400/25 bg-amber-400/[0.05] text-amber-300"
        : "border-gray-700 bg-gray-900 text-gray-400";

  return (
    <section className="silhat-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="silhat-eyebrow">Reconcile · production + outside evidence</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-100">What changed, and has production verified it?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            ailhat compares repository/release evidence with the last successful production scan. It can acknowledge a release chain, but it only calls current production clean after a newer scan verifies the checks ailhat can observe.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
          {stateLabel(reconciliation?.state)}
        </span>
      </div>

      {products.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Add a product before reconciling evidence.</p>
      ) : (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 text-sm text-gray-400">
            Product
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-gray-200"
            >
              {products.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || !productId}
            className="silhat-btn silhat-btn-ghost disabled:opacity-50"
          >
            {loading ? "Reconciling…" : "Refresh reconciliation"}
          </button>
          {reconciliation?.verificationRecommended && (
            <button
              type="button"
              onClick={() => void verify()}
              disabled={verifying || !product?.url}
              className="silhat-btn silhat-btn-primary disabled:opacity-50"
            >
              {verifying ? "Verifying…" : "Verify now"}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Last production scan" value={ageLabel(reconciliation?.latestProductionScanAt)} />
        <Metric label="Latest outside change" value={ageLabel(reconciliation?.latestExternalChangeAt)} />
        <Metric label="Active findings" value={String(reconciliation?.activeFindingCount ?? 0)} />
        <Metric label="Matched release chains" value={String(reconciliation?.releaseChains?.length ?? 0)} />
      </div>

      {reconciliation && (
        <div className="mt-4 rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <p className="text-sm leading-6 text-gray-300">{reconciliation.reason}</p>
          <p className="mt-2 text-xs leading-5 text-gray-500">
            Next · {reconciliation.recommendedAction}
          </p>
          {reconciliation.releaseChains.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {reconciliation.releaseChains.slice(0, 3).map((chain) => (
                <span
                  key={chain.commitSha}
                  className="rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-2.5 py-1 font-mono text-[10px] text-emerald-300"
                >
                  GitHub → Vercel · {chain.commitSha.slice(0, 7)}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {message && (
        <p className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs leading-5 text-gray-300">
          {message}
        </p>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-200">{value}</p>
    </div>
  );
}
