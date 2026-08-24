// Ailhat — Capacity & Allocation surface (/allocation).
// The dedicated, engine-driven "Agent Control / Portfolio command center" for
// Phase 5: where is my attention going, and where should the next window go?
//
// Every number here is derived from the attention engine — useAttention() gives
// the ranked, capacity + feedback weighted items and the CapacitySignals
// (capacity 0..1, products in motion, open findings/items, allocated spend,
// nextWindowLabel), and the new computeProductAllocations() derives a
// per-product recommended allocation from those same items + signals. It is a
// full surface, not a hand-maintained board: nothing is fabricated.
//
// Dark command-center aesthetic (dark neutral + electric cyan + blue signal,
// #7fb0ff accent). Identity = Ailhat only. NO purple.
import { createFileRoute } from "@tanstack/react-router";
import { StoreProvider, useStore } from "~/lib/useStore";
import { AuthProvider } from "~/lib/useAuth";
import AppShell from "~/components/AppShell";
import { useAttention } from "~/lib/useAttention";
import {
  ATTENTION_LABELS,
  ATTENTION_DOT,
  ATTENTION_TONE,
} from "~/lib/attention";

export const Route = createFileRoute("/allocation")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="allocation">
          <Allocation />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

/** Gauge + label colours: cyan (high capacity) → amber (mid) → rose (busy). */
function gaugeTone(pct: number) {
  const colour = pct >= 60 ? "bg-cyan-500" : pct >= 30 ? "bg-amber-500" : "bg-rose-500";
  const text =
    pct >= 60 ? "text-cyan-400" : pct >= 30 ? "text-amber-400" : "text-rose-400";
  const label =
    pct >= 60 ? "Plenty of room" : pct >= 30 ? "Moderately busy" : "Attention is tight";
  return { colour, text, label };
}

/* -------------------- Operating capacity -------------------- */

function CapacityGauge() {
  const { capacity } = useAttention();
  const pct = Math.round(capacity.capacity * 100);
  const { colour, text, label } = gaugeTone(pct);

  const stats: { k: string; v: string; sub?: string }[] = [
    { k: "Products in motion", v: String(capacity.productsInMotion), sub: `of ${capacity.productCount}` },
    { k: "Open findings", v: String(capacity.openFindings) },
    { k: "Open attention items", v: String(capacity.openItems) },
    { k: "Attention committed", v: `${Math.round(capacity.allocatedSpend * 100)}%` },
  ];

  return (
    <div className="silhat-panel p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-10">
        {/* Prominent gauge */}
        <div className="min-w-[220px] flex-1">
          <p className="silhat-eyebrow text-cyan-300">Operating capacity</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-5xl font-black tracking-tight ${text}`}>
              {pct}
              <span className="text-2xl font-bold text-gray-500">%</span>
            </span>
            <span className="text-sm text-gray-400">{label}</span>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-800">
            <div className={`h-2.5 rounded-full ${colour}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-400">
            Free attention available across your portfolio right now, after work
            already committed to in-motion products. Computed by the attention
            engine from observable store signals — not a guess.
          </p>
        </div>

        {/* Grounding breakdown */}
        <div className="grid grid-cols-2 gap-x-10 gap-y-4">
          {stats.map((s) => (
            <div key={s.k}>
              <p className="text-xs text-gray-500">{s.k}</p>
              <p className="mt-0.5 font-semibold text-gray-100">
                {s.v}
                {s.sub && (
                  <span className="text-xs font-medium text-gray-500"> {s.sub}</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------- Next window worth spending on -------------------- */

function NextWindow() {
  const { capacity } = useAttention();
  return (
    <div className="silhat-panel p-6">
      <p className="silhat-eyebrow text-cyan-300">Next window worth spending on</p>
      {capacity.nextWindowLabel ? (
        <p className="mt-3 text-lg font-semibold leading-snug text-gray-50">
          <span className="text-cyan-300">{capacity.nextWindowLabel}</span>
        </p>
      ) : (
        <p className="mt-3 text-lg font-semibold leading-snug text-gray-300">
          Nothing demanding attention — your next window is free.
        </p>
      )}
      <p className="mt-2 text-[13px] leading-relaxed text-gray-400">
        The highest marginal value-to-effort item in the ranked feed — the single
        best use of the next window of AI-operating attention, per the engine.
      </p>
    </div>
  );
}

/* -------------------- Per-product recommended allocation -------------------- */

function AllocationRow({ a, hasLoad }: { a: { recommendedPercent: number; inMotion: boolean }; hasLoad: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="w-10 text-right font-mono text-sm font-bold text-gray-100">
        {a.recommendedPercent}%
      </span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-800">
        <span
          className={`h-1.5 rounded-full ${a.inMotion ? "bg-[#7fb0ff]" : "bg-gray-600"}`}
          style={{ width: hasLoad ? `${a.recommendedPercent}%` : "0%" }}
        />
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          a.inMotion
            ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
        }`}
      >
        {a.inMotion ? "In motion" : "Idle"}
      </span>
    </span>
  );
}

/* -------------------- Section header / page -------------------- */

function Allocation() {
  const { ready } = useStore();
  const { allocations, items } = useAttention();

  const hasAnyLoad = allocations.some((a) => a.load > 0);
  const openCount = items.length;

  return (
    <div className="space-y-6">
      {!ready ? (
        <p className="py-20 text-center text-gray-500">Loading…</p>
      ) : (
        <>
          <section>
            <div className="flex flex-wrap items-center gap-2">
              <p className="silhat-eyebrow text-cyan-300">Intelligence · Capacity &amp; Allocation</p>
              <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                Phase 5
              </span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
              Where should attention go next?
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              Your operating capacity, the products in motion, the next window
              worth spending on, and a per-product allocation — all driven by the
              attention engine from observable signals.
            </p>
          </section>

          <CapacityGauge />
          <NextWindow />

          {/* Per-product recommended allocation */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-gray-100">
                Recommended allocation
              </h2>
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-gray-400">
                {allocations.length} product{allocations.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="mb-4 text-[13px] text-gray-400">
              Each product's share of the portfolio's total open attention load
              (the sum of its ranked, capacity + feedback weighted scores). The
              product owning the next window is highlighted.
            </p>

            {allocations.length === 0 ? (
              <div className="silhat-panel border-dashed px-6 py-16 text-center">
                <p className="text-lg font-semibold text-gray-200">No products yet</p>
                <p className="mt-1 text-sm text-gray-400">
                  Add products to see how your attention should be allocated.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {allocations.map((a) => (
                  <div
                    key={a.productId}
                    className={`silhat-panel p-5 ${
                      a.nextWindowFor ? "ring-1 ring-cyan-700/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-gray-700 bg-gray-800 text-[11px] font-bold text-gray-200">
                          {a.productName.charAt(0).toUpperCase()}
                        </span>
                        <h3 className="truncate font-semibold text-gray-50">
                          {a.productName}
                        </h3>
                        {a.nextWindowFor && (
                          <span className="shrink-0 rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-bold uppercase text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
                            Next window
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-gray-500">
                        {a.openItems} open{" "}
                        {a.openItems === 1 ? "item" : "items"}
                        {a.openFindings > 0
                          ? ` · ${a.openFindings} finding${a.openFindings === 1 ? "" : "s"}`
                          : ""}
                      </span>
                    </div>

                    <div className="mt-4">
                      <AllocationRow a={a} hasLoad={hasAnyLoad} />
                      <p className="mt-1.5 text-[11px] text-gray-500">
                        {hasAnyLoad && a.load > 0
                          ? `Recommended effort share · ${a.recommendedPercent}% of the portfolio's open attention load`
                          : "No open attention items — nothing allocated this window"}
                      </p>
                    </div>

                    {a.bestItemTitle && a.bestClassName ? (
                      <div className="mt-4 rounded-lg bg-gray-900 px-3 py-2.5 ring-1 ring-gray-800">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Highest-leverage item
                        </p>
                        <div className="mt-1 flex items-start gap-2">
                          <span
                            className={`mt-0.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${ATTENTION_TONE[a.bestClassName]}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${ATTENTION_DOT[a.bestClassName]}`}
                            />
                            {ATTENTION_LABELS[a.bestClassName]}
                          </span>
                          <p className="min-w-0 text-sm text-gray-200">
                            <span className="line-clamp-2">{a.bestItemTitle}</span>
                            <span className="ml-1 font-mono text-xs text-gray-500">
                              {a.bestScore}/100
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-lg bg-gray-900 px-3 py-2 text-xs text-gray-500 ring-1 ring-gray-800">
                        No attention signals — nothing competing for this window.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="mt-4 text-[11px] text-gray-500">
              Allocation is engine-derived: each product's open attention items
              (weighted by capacity and your feedback) as a share of the
              portfolio total. {openCount} open attention item{openCount === 1 ? "" : "s"} currently
              ranked. In motion = a product with open checklist items or open
              scan findings (matches Operating capacity).
            </p>
          </section>
        </>
      )}
    </div>
  );
}
