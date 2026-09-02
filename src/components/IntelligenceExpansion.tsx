import { Link } from "@tanstack/react-router";
import RadarSection from "~/components/RadarSection";
import { useStore } from "~/lib/useStore";

const FRESH_SCAN_MS = 7 * 24 * 60 * 60 * 1000;

export default function IntelligenceExpansion() {
  const { state } = useStore();

  return (
    <div className="space-y-6">
      <RadarSection />

      <section className="silhat-panel p-5">
        <div>
          <p className="silhat-eyebrow">Launch Readiness · evidence coverage</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-100">Is the portfolio actually ready to receive users?</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-500">
            Readiness is derived only from evidence ailhat currently has. Unknown checks remain unknown; repository work or a successful deployment is not presented as proof that auth, forms, analytics, mobile journeys, accessibility, or conversion paths all work.
          </p>
        </div>

        {state.products.length === 0 ? (
          <p className="mt-5 text-sm text-gray-500">Add a product before evaluating launch evidence.</p>
        ) : (
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {state.products.map((product) => {
              const history = state.scanHistory?.[product.id];
              const lastGood = history?.lastGood;
              const presentFindings = Object.values(history?.issues ?? {}).filter((issue) => issue.present);
              const openWork = state.items.filter((item) => item.productId === product.id && item.status !== "done");
              const fresh = Boolean(lastGood && Date.now() - lastGood.scannedAt <= FRESH_SCAN_MS);
              const status = !product.url
                ? "Needs URL"
                : !lastGood
                  ? "Needs production evidence"
                  : presentFindings.length > 0 || openWork.length > 0
                    ? "Review blockers"
                    : fresh
                      ? "Observed clear · limited scope"
                      : "Evidence stale";
              const statusClass =
                status === "Observed clear · limited scope"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : status === "Review blockers"
                    ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
                    : "border-amber-500/25 bg-amber-500/10 text-amber-300";

              return (
                <article key={product.id} className="rounded-xl border border-gray-800 bg-gray-950/55 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-gray-100">{product.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-600">{product.url || "No production URL recorded"}</p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusClass}`}>{status}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2"><strong className="block text-sm text-gray-200">{presentFindings.length}</strong><span className="text-gray-600">active findings</span></div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2"><strong className="block text-sm text-gray-200">{openWork.length}</strong><span className="text-gray-600">open work</span></div>
                    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-2"><strong className="block text-sm text-gray-200">{lastGood ? new Date(lastGood.scannedAt).toLocaleDateString() : "—"}</strong><span className="text-gray-600">last scan</span></div>
                  </div>
                  <Link to="/product/$productId" params={{ productId: product.id }} className="mt-4 inline-block text-xs font-semibold text-[#7fb0ff] hover:underline">Open Product Cockpit →</Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
