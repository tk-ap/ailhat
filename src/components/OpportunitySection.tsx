// Phase 3 — Opportunity engine UI. Renders ranked, evidence-backed opportunities
// in the Intelligence area (surfaced on the /brief page beneath the attention
// engine). Each card shows type/bucket/score, the explained why-it-matters, the
// recommended action, cited evidence, confidence, and [Create task] [Investigate]
// [Dismiss] actions (Create-task dedups into the checklist; feedback persists
// so Phase 5 can personalise).
import { useState } from "react";
import { useOpportunities } from "~/lib/useOpportunities";
import {
  type Opportunity,
  BUCKET_LABELS,
  BUCKET_TONE,
  CONF_TONE,
  TYPE_LABELS,
  TYPE_TONE,
} from "~/lib/opportunity";

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
        <span className="font-medium text-gray-400">{label}</span>
        <span className="font-semibold text-gray-200">{pct}%</span>
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

function OpportunityCard({
  opp,
  rank,
}: {
  opp: Opportunity;
  rank: number;
}) {
  const { createTask, feedback } = useOpportunities();
  const [note, setNote] = useState("");

  const doCreate = () => {
    const { added, skipped } = createTask(opp);
    feedback(opp.id, "acted");
    const bits =
      added > 0
        ? `✓ Added to ${opp.productName}'s checklist`
        : skipped > 0
          ? `${opp.title} is already on the checklist`
          : "✓ Marked";
    setNote(bits);
  };

  const doDismiss = () => {
    feedback(opp.id, "dismissed");
    setNote("Dismissed — we'll stop surfacing this.");
  };

  const doInvestigate = () => {
    feedback(opp.id, "more");
    setNote("Marked for investigation — we'll keep it and learn from your focus.");
  };

  return (
    <article className="silhat-panel border-emerald-900/40">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            #{rank}
          </span>
          <Pill text={TYPE_LABELS[opp.type]} tone={TYPE_TONE[opp.type]} />
          <Pill text={BUCKET_LABELS[opp.bucket]} tone={BUCKET_TONE[opp.bucket]} />
          <Pill text={`${opp.confidence} confidence`} tone={CONF_TONE[opp.confidence]} />
          <Pill text={`${opp.effortLabel} effort`} tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" />
          <span className="ml-auto font-mono text-lg font-bold text-gray-100">
            {opp.score}
            <span className="text-xs font-medium text-gray-500">/100</span>
          </span>
        </div>

        <h3 className="mt-3 text-lg font-bold leading-snug">{opp.title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {opp.description}
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Why it matters + breakdown */}
          <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Why it matters
              </div>
              <p className="mt-1 text-gray-300">{opp.recommendation}</p>
            </div>
            <div className="space-y-2">
              <BreakdownRow label="Potential impact" value={opp.impact} tone="bg-emerald-500" />
              <BreakdownRow label="Evidence strength" value={opp.evidenceScore} tone="bg-sky-500" />
              <BreakdownRow label="Strategic fit" value={opp.fit} tone="bg-cyan-500" />
              <BreakdownRow label="Ease of execution" value={opp.ease} tone="bg-amber-500" />
            </div>
            <p className="text-[11px] leading-relaxed text-gray-500">
              Score = 40% impact · 30% evidence · 15% fit · 15% ease, normalised to
              0–100.
            </p>
          </div>

          {/* Evidence + action */}
          <div className="space-y-3 rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Evidence observed
              </div>
              <ul className="mt-1.5 space-y-1.5">
                {opp.evidence.map((e, idx) => (
                  <li key={idx} className="flex gap-2 text-gray-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Recommended action
              </div>
              <p className="mt-1 font-medium text-gray-100">{opp.action}</p>
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
      </div>
    </article>
  );
}

/** The full Opportunities section for the Intelligence area. */
export default function OpportunitySection() {
  const { opportunities, hidden, opportunityCount } = useOpportunities();

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center gap-2">
        <p className="silhat-eyebrow">Intelligence · Opportunities</p>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Phase 3
        </span>
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
        What to improve next
      </h2>
      <p className="mt-1 text-sm text-gray-400">
        Evidence-backed improvements worth making — scored by impact, evidence,
        fit, and effort. Every opportunity cites the site-scan finding it came
        from.
      </p>

      {hidden > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {hidden} opportunity{hidden > 1 ? "ies" : "y"} hidden by your feedback.
        </p>
      )}

      {opportunityCount === 0 ? (
        <div className="silhat-panel mt-4 border-dashed p-10 text-center">
          <p className="text-lg font-semibold text-gray-200">No opportunities yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Opportunities are derived from real site scans. Add a product and
            scan it (or let auto-scan run on the dashboard) to surface
            improvements grounded in evidence.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 xl:grid-cols-2">
          {opportunities.map((o, i) => (
            <OpportunityCard key={o.id} opp={o} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}
