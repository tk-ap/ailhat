// Phase 4 — Market-gap engine UI. Sibling grouping to the Phase 3 Opportunity
// section. Surfaces ranked MARKET/COMPETITIVE gaps — "something the category /
// competitors provide that ailhat doesn't" — each with category, the
// "category provides vs ailhat omits" description, evidence/source note,
// confidence, an explained score breakdown, a recommended bridge/action, and
// feedback actions (Create task / Investigate / Dismiss). Same status lifecycle
// and feedback store as Opportunities so Phase 5 can unify them.
import { useState } from "react";
import { useMarketGaps } from "~/lib/useMarketGaps";
import {
  BUCKET_LABELS,
  BUCKET_TONE,
  CONF_TONE,
  TYPE_LABELS,
  TYPE_TONE,
} from "~/lib/opportunity";
import type { MarketGapOpportunity } from "~/lib/marketGap";

function Pill({ text, tone }: { text: string; tone: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}
    >
      {text}
    </span>
  );
}

function BreakdownRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number; // 0..1
  tone: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-400 dark:text-gray-500">{label}</span>
        <span className="font-semibold text-gray-200 dark:text-gray-300">{pct}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-gray-800">
        <div
          className={`h-1.5 rounded-full ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GapCard({ gap, rank }: { gap: MarketGapOpportunity; rank: number }) {
  const { createTask, feedback, anchorProductId } = useMarketGaps();
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);

  const doCreate = () => {
    const { added, skipped } = createTask(gap);
    feedback(gap.id, "acted");
    const bits =
      added > 0
        ? anchorProductId
          ? "✓ Added to your portfolio checklist"
          : "✓ Marked (add a product first to see it on a checklist)"
        : skipped > 0
          ? `${gap.title} is already on the checklist`
          : "✓ Marked";
    setNote(bits);
  };

  const doDismiss = () => {
    feedback(gap.id, "dismissed");
    setNote("Dismissed — we'll stop surfacing this.");
  };

  const doInvestigate = () => {
    feedback(gap.id, "more");
    setNote("Marked for investigation — we'll keep it and learn from your focus.");
  };

  return (
    <article className="silhat-panel border-orange-900/40">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-orange-800 dark:bg-orange-950 dark:text-orange-300">
            #{rank}
          </span>
          <Pill text={TYPE_LABELS[gap.type]} tone={TYPE_TONE[gap.type]} />
          <Pill text={BUCKET_LABELS[gap.bucket]} tone={BUCKET_TONE[gap.bucket]} />
          <Pill text={`${gap.confidence} confidence`} tone={CONF_TONE[gap.confidence]} />
          <Pill
            text={`${gap.effortLabel} effort`}
            tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
          />
          <span className="ml-auto font-mono text-lg font-bold text-gray-100 dark:text-gray-100">
            {gap.score}
            <span className="text-xs font-medium text-gray-500">/100</span>
          </span>
        </div>

        <h3 className="mt-3 text-lg font-bold leading-snug">{gap.title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{gap.description}</p>

        <div className="mt-2 flex flex-wrap gap-2">
          <Pill text={gap.category} tone="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" />
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
            Source · {gap.sourceNote}
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Why it matters + breakdown */}
          <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                Why it matters
              </div>
              <p className="mt-1 text-gray-300 dark:text-gray-300">{gap.recommendation}</p>
            </div>
            <div className="space-y-2">
              <BreakdownRow label="Potential impact" value={gap.impact} tone="bg-emerald-500" />
              <BreakdownRow label="Evidence strength" value={gap.evidenceScore} tone="bg-sky-500" />
              <BreakdownRow label="Strategic fit" value={gap.fit} tone="bg-cyan-500" />
              <BreakdownRow label="Ease of execution" value={gap.ease} tone="bg-amber-500" />
            </div>
            <p className="text-[11px] leading-relaxed text-gray-500">
              Score = 40% impact · 30% evidence · 15% fit · 15% ease, normalised to
              0–100.
            </p>
          </div>

          {/* Evidence + bridge */}
          <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                Why it's a gap — evidence
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {gap.evidence.map((e, idx) => (
                  <li key={idx} className="flex gap-2 text-gray-300 dark:text-gray-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                    {e}
                  </li>
                ))}
              </ul>
              {gap.competitors.length > 0 && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Provided today by: {gap.competitors.join(", ")}.
                </p>
              )}
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                Bridge / recommended action
              </div>
              <p className="mt-1 font-medium text-gray-100 dark:text-gray-100">{gap.action}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={doCreate} className="silhat-btn silhat-btn-primary">
            Create task
          </button>
          <button onClick={doInvestigate} className="silhat-btn silhat-btn-ghost">
            Investigate
          </button>
          <button onClick={doDismiss} className="silhat-btn silhat-btn-ghost">
            Dismiss
          </button>
        </div>
        {note && (
          <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            {note}
          </p>
        )}

        <button
          onClick={() => setShowMore((v) => !v)}
          className="mt-4 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          {showMore ? "Hide detail" : "Tell me more"}
        </button>
        {showMore && (
          <div className="mt-2 rounded-lg border border-gray-800 bg-gray-900 p-3 text-xs text-gray-400">
            <p>
              <span className="font-semibold text-gray-300">Gap id:</span>{" "}
              <code>{gap.id}</code>
            </p>
            <p className="mt-1 text-gray-400">
              This is a market/competitive gap checked against the portfolio — a
              structural "category provides vs ailhat omits" comparison, grounded
              in market-gap research; no competitor pricing is quoted.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

/** The full Market Gaps section for the Intelligence area (Phase 4). */
export default function MarketGapSection() {
  const { gaps, hidden, gapCount } = useMarketGaps();

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="silhat-eyebrow">Intelligence · Market gaps</p>
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-50 dark:text-gray-50">
        What the category gives you that ailhat doesn't
      </h2>
      <p className="mt-1 text-sm text-gray-400 dark:text-gray-400">
        Observed market-coverage gaps vs. the category and competitors — ranked,
        evidence-backed, with a concrete bridge for each. These are structural
        comparisons grounded in research, not made-up share claims.
      </p>

      {hidden > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {hidden} market gap{hidden > 1 ? "s" : ""} hidden by your feedback.
        </p>
      )}

      {gapCount === 0 ? (
        hidden > 0 ? (
          <div className="silhat-panel mt-4 border-dashed px-6 py-16 text-center">
            <p className="text-lg font-semibold text-gray-200 dark:text-gray-200">
              No market gaps to show
            </p>
            <p className="mt-1 text-sm text-gray-400">
              All observed market gaps are hidden by your feedback.
            </p>
          </div>
        ) : (
          <div className="silhat-panel mt-4 border-dashed px-6 py-16 text-center">
            <p className="text-lg font-semibold text-gray-200 dark:text-gray-200">
              No market gaps observed yet
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Market gaps are derived from category and competitive research
              against your portfolio. Add or scan products to surface gaps
              grounded in evidence.
            </p>
          </div>
        )
      ) : (
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          {gaps.map((g, i) => (
            <GapCard key={g.id} gap={g} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
