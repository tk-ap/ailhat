import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useBrief } from "~/lib/useBrief";
import type { AttentionLevel, Signal } from "~/lib/brief";

const LEVELS: AttentionLevel[] = ["ACT_NOW", "REVIEW", "OPPORTUNITY", "HEALTHY"];
const LABEL: Record<AttentionLevel, string> = {
  ACT_NOW: "Act now",
  REVIEW: "Review",
  OPPORTUNITY: "Opportunity",
  HEALTHY: "Healthy",
};

function HighestLeverageToday({ signal }: { signal: Signal | null }) {
  const { expandToChecklist, activate, feedback } = useBrief();
  const [result, setResult] = useState("");

  if (!signal) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-950/55 px-4 py-4">
        <p className="silhat-eyebrow">Highest-leverage action</p>
        <p className="mt-1 text-sm font-semibold text-gray-200">Nothing needs immediate attention.</p>
      </div>
    );
  }

  const act = () => {
    const { added, skipped } = expandToChecklist(signal);
    activate(signal);
    feedback(signal.id, "acted");
    const parts: string[] = [];
    if (added) parts.push(`${added} added`);
    if (skipped) parts.push(`${skipped} already present`);
    setResult(parts.length ? `✓ ${parts.join(" · ")}` : "✓ marked as handled");
  };

  return (
    <div className="rounded-xl border border-[#7fb0ff]/25 bg-[#7fb0ff]/[0.05] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="silhat-eyebrow text-[#9cc8ff]">Highest-leverage action</p>
        <span className="rounded-full border border-gray-700 bg-gray-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {LABEL[signal.level]}
        </span>
      </div>
      <h2 className="mt-2 text-lg font-semibold text-gray-50">{signal.title}</h2>
      <p className="mt-1 text-sm leading-6 text-gray-400">{signal.summary}</p>
      <p className="mt-2 text-sm text-gray-300">
        <span className="font-semibold text-[#9cc8ff]">Recommendation: </span>
        {signal.recommendation}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={act} className="silhat-btn silhat-btn-primary">Act on it</button>
        <button type="button" onClick={() => feedback(signal.id, "snoozed")} className="silhat-btn silhat-btn-ghost">Snooze</button>
        {signal.productId && (
          <Link to="/product/$productId" params={{ productId: signal.productId }} className="silhat-btn silhat-btn-ghost">
            Product cockpit →
          </Link>
        )}
      </div>
      {result && <p className="mt-2 text-xs font-semibold text-emerald-300">{result}</p>}
    </div>
  );
}

export default function TodayAttentionSummary() {
  const { summary, signals, productCount } = useBrief();

  return (
    <section className="mb-6 silhat-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="silhat-eyebrow">Today · current attention</p>
          <h1 className="mt-1 text-xl font-semibold text-gray-50">What needs your attention now?</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live portfolio attention across {productCount} product{productCount === 1 ? "" : "s"}. Deeper judgment stays in Intelligence.
          </p>
        </div>
        <Link to="/brief" className="text-xs font-semibold text-[#7fb0ff] hover:underline">
          Open Intelligence →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEVELS.map((level) => (
          <div key={level} className="rounded-lg border border-gray-800 bg-gray-950/55 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-600">{LABEL[level]}</p>
            <p className="mt-1 text-xl font-semibold text-gray-200">{summary.counts[level]}</p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <HighestLeverageToday signal={summary.highest} />
      </div>

      {signals.length > 1 && (
        <p className="mt-3 text-xs text-gray-600">
          {signals.length - 1} additional ranked signal{signals.length - 1 === 1 ? "" : "s"} remain in the portfolio. Product tiles below carry the active work context.
        </p>
      )}
    </section>
  );
}
