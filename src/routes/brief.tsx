import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { StoreProvider, useStore } from "~/lib/useStore";
import { AuthProvider } from "~/lib/useAuth";
import AppShell from "~/components/AppShell";
import { useBrief } from "~/lib/useBrief";
import {
  type AttentionLevel,
  type Signal,
  LEVEL_ORDER,
  OLD_BUG_DAYS,
  SCAN_FRESH_DAYS,
  STALLED_DONE_DAYS,
  STALLED_OPEN,
} from "~/lib/brief";
import { typeLabel } from "~/lib/store";
import OpportunitySection from "~/components/OpportunitySection";
import MarketGapSection from "~/components/MarketGapSection";

export const Route = createFileRoute("/brief")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="intelligence">
          <Brief />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

const LEVEL_META: Record<
  AttentionLevel,
  { label: string; dot: string; badge: string; border: string; heading: string; eyebrow: string }
> = {
  ACT_NOW: {
    label: "Act now",
    dot: "bg-rose-500",
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-900",
    heading: "Act now",
    eyebrow: "text-rose-400",
  },
  REVIEW: {
    label: "Review",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-900",
    heading: "Review",
    eyebrow: "text-amber-400",
  },
  OPPORTUNITY: {
    label: "Opportunity",
    dot: "bg-emerald-500",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-900",
    heading: "Opportunity",
    eyebrow: "text-emerald-400",
  },
  HEALTHY: {
    label: "Healthy",
    dot: "bg-gray-300 dark:bg-gray-600",
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-800",
    heading: "Healthy",
    eyebrow: "text-gray-500 dark:text-gray-400",
  },
};

const LEVELS: AttentionLevel[] = ["ACT_NOW", "REVIEW", "OPPORTUNITY", "HEALTHY"].sort(
  (a, b) => LEVEL_ORDER[a] - LEVEL_ORDER[b],
);

/* ---------- Highest-leverage action card ---------- */

function HighestLeverage({ signal }: { signal: Signal | null }) {
  const { expandToChecklist, activate, feedback, productCount } = useBrief();
  const [done, setDone] = useState("");

  if (!signal) {
    return (
      <section className="silhat-panel p-6">
        <p className="silhat-eyebrow">Highest-leverage action</p>
        <p className="mt-2 text-xl font-bold text-gray-300">
          Nothing needs your attention right now
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Your portfolio of {productCount} product{productCount === 1 ? "" : "s"} is clear.
        </p>
      </section>
    );
  }

  const meta = LEVEL_META[signal.level];

  const doAct = () => {
    const { added, skipped } = expandToChecklist(signal);
    activate(signal);
    feedback(signal.id, "acted");
    const bits: string[] = [];
    if (added > 0) bits.push(`${added} checklist item${added > 1 ? "s" : ""} added`);
    if (skipped > 0) bits.push(`${skipped} already present`);
    if (signal.actOnItem) bits.push(signal.actOnItem.label.toLowerCase());
    setDone(added + skipped > 0 || signal.actOnItem ? `✓ ${bits.join(", ")}` : "✓ marked as handled");
  };

  return (
    <section className="silhat-panel border-cyan-800/60 p-6">
      <div className="flex items-center justify-between gap-2">
        <p className="silhat-eyebrow text-cyan-300">Highest-leverage action</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${meta.badge}`}>
          {meta.label}
        </span>
      </div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-50">{signal.title}</h2>
      <p className="mt-2 text-gray-300">{signal.summary}</p>
      <p className="mt-3 rounded-lg bg-gray-900 px-4 py-3 text-sm ring-1 ring-gray-800">
        <span className="font-semibold text-cyan-300">Recommendation: </span>
        {signal.recommendation}
      </p>
      <p className="mt-2 text-sm text-gray-400">{signal.action}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={doAct}
          className="silhat-btn silhat-btn-primary"
        >
          Act on it
        </button>
        <button
          onClick={() => feedback(signal.id, "snoozed")}
          className="silhat-btn silhat-btn-ghost"
        >
          Snooze
        </button>
        <button
          onClick={() => feedback(signal.id, "dismissed")}
          className="silhat-btn silhat-btn-ghost"
        >
          Dismiss
        </button>
      </div>
      {done && <p className="mt-3 text-sm font-medium text-emerald-400">{done}</p>}
    </section>
  );
}

/* ---------- Individual signal card ---------- */

function SignalCard({ signal }: { signal: Signal }) {
  const { expandToChecklist, activate, feedback } = useBrief();
  const [showChecklist, setShowChecklist] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [result, setResult] = useState("");

  const meta = LEVEL_META[signal.level];
  const recs = signal.recItems;

  const doAct = () => {
    const { added, skipped } = expandToChecklist(signal);
    activate(signal);
    feedback(signal.id, "acted");
    const bits: string[] = [];
    if (added > 0) bits.push(`${added} item${added > 1 ? "s" : ""} added to checklist`);
    if (skipped > 0) bits.push(`${skipped} already present`);
    if (signal.actOnItem) bits.push(signal.actOnItem.label.toLowerCase());
    setResult(added + skipped > 0 || signal.actOnItem ? `✓ ${bits.join(", ")}` : "✓ marked as handled");
  };

  const addRecs = () => {
    const { added, skipped } = expandToChecklist(signal);
    feedback(signal.id, "acted");
    setResult(`✓ ${added} item${added === 1 ? "" : "s"} added to ${signal.productName ?? "checklist"}${skipped > 0 ? ` (${skipped} already present)` : ""}`);
  };

  return (
    <article className={`silhat-panel ${meta.border}`}>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${meta.badge}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          {signal.productName && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {signal.productName}
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg font-bold leading-snug">{signal.title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{signal.summary}</p>

        {/* Signal → Evidence → Reasoning → Recommendation → Action */}
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Evidence</dt>
            <dd className="mt-1 space-y-1">
              {signal.evidence.map((e, idx) => (
                <p key={idx} className="flex gap-2 text-gray-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                  {e}
                </p>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reasoning</dt>
            <dd className="mt-1 text-gray-300">{signal.reasoning}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recommendation</dt>
            <dd className="mt-1 font-medium text-gray-100">{signal.recommendation}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Action</dt>
            <dd className="mt-1 text-gray-300">{signal.action}</dd>
          </div>
        </dl>

        {/* Expand → checklist */}
        {recs.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowChecklist((v) => !v)}
              className="text-sm font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
            >
              {showChecklist ? "Hide checklist" : "Expand → checklist"}
            </button>
            {showChecklist && (
              <div className="mt-3 space-y-2 rounded-xl border border-cyan-100 bg-cyan-50/40 p-3 dark:border-cyan-900 dark:bg-cyan-950/20">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Turning this into checklist items on {signal.productName}:
                </p>
                <ul className="space-y-1.5">
                  {recs.map((r, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300">
                        {typeLabel(r.type)}
                      </span>
                      {r.title}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={addRecs}
                  className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                >
                  Add {recs.length === 1 ? "item" : `${recs.length} items`} to {signal.productName}
                </button>
              </div>
            )}
          </div>
        )}

        {result && <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">{result}</p>}

        {/* Tell me more — how the signal was computed */}
        <button
          onClick={() => setShowMore((v) => !v)}
          className="mt-4 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {showMore ? "Hide detail" : "Tell me more"}
        </button>
        {showMore && (
          <div className="mt-2 rounded-lg border border-gray-800 bg-gray-900 p-3 text-xs text-gray-400">
            <p><span className="font-semibold text-gray-300">Rule:</span> <code>{signal.id}</code></p>
            <p className="mt-1">
              <span className="font-semibold">Thresholds:</span>{" "}
              stale bug &gt; {OLD_BUG_DAYS} days · open concentration &ge; {STALLED_OPEN} with no done work in
              {STALLED_DONE_DAYS} days · fresh site-scan within {SCAN_FRESH_DAYS} days.
            </p>
          </div>
        )}

        {/* Feedback loop — how Ailhat learns */}
        <div className="mt-5 border-t border-gray-800 pt-4">
          <p className="mb-2 silhat-eyebrow">Was this useful?</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={doAct}
              className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-200 dark:bg-rose-950 dark:text-rose-300"
            >
              Act
            </button>
            <button
              onClick={() => feedback(signal.id, "snoozed")}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
            >
              Snooze
            </button>
            <button
              onClick={() => feedback(signal.id, "dismissed")}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
            >
              Dismiss
            </button>
            <button
              onClick={() => feedback(signal.id, "not_important")}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
            >
              Not important
            </button>
            <button
              onClick={() => feedback(signal.id, "already_handled")}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
            >
              Already handled
            </button>
            <button
              onClick={() => feedback(signal.id, "wrong")}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
            >
              Wrong
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------- Brief page ---------- */

function Brief() {
  const { state, ready } = useStore();
  const { signals, summary, productCount } = useBrief();

  return (
    <div className="space-y-6">
      {!ready ? (
        <p className="py-20 text-center text-gray-500">Loading…</p>
      ) : (
        <>
          <section>
            <p className="silhat-eyebrow">Intelligence · Daily brief</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">Daily brief</h1>
            <p className="mt-1 text-sm text-gray-400">
              What needs your attention across {productCount} product{productCount === 1 ? "" : "s"}?
            </p>

            {/* Portfolio summary */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LEVELS.map((lv) => {
                const m = LEVEL_META[lv];
                return (
                  <div key={lv} className={`silhat-panel p-4 ${m.border}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                      <span className={`silhat-eyebrow ${m.eyebrow}`}>{m.heading}</span>
                    </div>
                    <p className="mt-1.5 text-2xl font-bold text-gray-50">{summary.counts[lv]}</p>
                  </div>
                );
              })}
            </div>
            {summary.hidden > 0 && (
              <p className="mt-3 text-xs text-gray-500">
                {summary.hidden} signal{summary.hidden > 1 ? "s" : ""} hidden by your feedback.
              </p>
            )}
          </section>

          <HighestLeverage signal={summary.highest} />

          <section>
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold tracking-tight text-gray-100">
              Ranked attention
              <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-400">
                {signals.length}
              </span>
            </h2>

            {signals.length === 0 ? (
              <div className="silhat-panel border-dashed px-6 py-16 text-center">
                <p className="text-lg font-semibold text-gray-200">Nothing to show</p>
                <p className="mt-1 text-sm text-gray-400">
                  All signals are handled or hidden. Add products/items or reset demo data to regenerate.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {signals.map((s) => (
                  <SignalCard key={s.id} signal={s} />
                ))}
              </div>
            )}
          </section>

          {state.products.length === 0 && (
            <section className="silhat-panel border-dashed px-6 py-16 text-center">
              <p className="text-lg font-semibold text-gray-200">Add products to get a brief</p>
              <p className="mt-1 text-sm text-gray-400">
                Your brief is built from the products and checklist items in your portfolio.
              </p>
              <Link
                to="/dashboard"
                className="silhat-btn silhat-btn-primary mt-4 px-5 py-2"
              >
                Go to dashboard
              </Link>
            </section>
          )}

          {/* Phase 3 — Opportunity engine */}
          <OpportunitySection />

          {/* Phase 4 — Market-gap engine */}
          <MarketGapSection />
        </>
      )}
    </div>
  );
}
