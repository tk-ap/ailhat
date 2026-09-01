import { useState } from "react";
import {
  RADAR_RECOMMENDATIONS,
  normalizeExternalSignal,
  type ExternalSignalDraft,
  type ExternalSignalInputMode,
  type RadarRecommendation,
  type SignalType,
} from "~/lib/external-signal";
import { useStore } from "~/lib/useStore";

const DEFAULT_DRAFT: ExternalSignalDraft = {
  input_mode: "url",
  source: "",
  signal_type: "opportunity",
  problem: "",
  audience: "",
  evidence: "",
  market_momentum: 3,
  portfolio_adjacency: 3,
  founder_fit: 3,
  existing_leverage: 3,
  execution_cost: 3,
  strategic_risk: 2,
};

const METRICS: { key: keyof ExternalSignalDraft; label: string; inverse?: boolean }[] = [
  { key: "market_momentum", label: "Market momentum" },
  { key: "portfolio_adjacency", label: "Portfolio adjacency" },
  { key: "founder_fit", label: "Founder fit" },
  { key: "existing_leverage", label: "Existing leverage" },
  { key: "execution_cost", label: "Execution cost", inverse: true },
  { key: "strategic_risk", label: "Strategic risk", inverse: true },
];

const RECOMMENDATION_TONE: Record<RadarRecommendation, string> = {
  ABSORB: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  EXTEND: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  EXPERIMENT: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  WATCH: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  SPIN_OUT: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  REJECT: "border-gray-700 bg-gray-900 text-gray-400",
};

export default function RadarSection() {
  const { state, actions } = useStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExternalSignalDraft>(DEFAULT_DRAFT);
  const [error, setError] = useState("");
  const signals = state.externalSignals ?? [];

  const setField = <K extends keyof ExternalSignalDraft>(
    key: K,
    value: ExternalSignalDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.source.trim() || !draft.problem.trim() || !draft.audience.trim()) {
      setError("Source, problem, and audience are required.");
      return;
    }
    actions.addExternalSignal(normalizeExternalSignal(draft));
    setDraft(DEFAULT_DRAFT);
    setError("");
    setOpen(false);
  };

  return (
    <section className="silhat-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 p-5">
        <div>
          <p className="silhat-eyebrow">RADAR · external signal intake</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-50">What changed outside the portfolio?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Capture an outside signal, then assess what it means for the products and leverage you already have. RADAR does not generate generic ideas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="silhat-btn silhat-btn-primary px-4 py-2"
          aria-expanded={open}
        >
          {open ? "Close" : "+ Add external signal"}
        </button>
      </div>

      {open ? (
        <form onSubmit={submit} className="space-y-5 bg-gray-950/40 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs font-medium text-gray-400">
              Capture mode
              <select className="silhat-input mt-1" value={draft.input_mode} onChange={(event) => setField("input_mode", event.target.value as ExternalSignalInputMode)}>
                <option value="url">URL</option><option value="text">Text</option><option value="manual">Manual</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-400 md:col-span-2">
              Source
              <input className="silhat-input mt-1" value={draft.source} onChange={(event) => setField("source", event.target.value)} placeholder={draft.input_mode === "url" ? "https://…" : "Publication, interview, note…"} />
            </label>
            <label className="text-xs font-medium text-gray-400">
              Signal type
              <select className="silhat-input mt-1" value={draft.signal_type} onChange={(event) => setField("signal_type", event.target.value as SignalType)}>
                <option value="opportunity">Opportunity</option><option value="risk">Risk</option><option value="trend">Trend</option><option value="customer-pain">Customer pain</option><option value="capability">Capability</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-400 md:col-span-2">
              Problem observed
              <input className="silhat-input mt-1" value={draft.problem} onChange={(event) => setField("problem", event.target.value)} placeholder="What underlying problem does this signal reveal?" />
            </label>
            <label className="text-xs font-medium text-gray-400 md:col-span-3">
              Audience
              <input className="silhat-input mt-1" value={draft.audience} onChange={(event) => setField("audience", event.target.value)} placeholder="Who experiences it?" />
            </label>
            <label className="text-xs font-medium text-gray-400 md:col-span-3">
              Evidence · one item per line
              <textarea className="silhat-input mt-1 min-h-24" value={draft.evidence as string} onChange={(event) => setField("evidence", event.target.value)} placeholder="Observed demand, customer language, category movement…" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((metric) => (
              <label key={metric.key} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-xs font-medium text-gray-400">
                <span className="flex justify-between gap-3"><span>{metric.label}</span><strong className="text-gray-200">{draft[metric.key] as number}/5</strong></span>
                <input type="range" min="0" max="5" step="1" className="mt-3 w-full accent-[#7fb0ff]" value={draft[metric.key] as number} onChange={(event) => setField(metric.key, Number(event.target.value))} aria-label={metric.label} />
                <span className="mt-1 flex justify-between text-[10px] text-gray-600"><span>{metric.inverse ? "Low" : "Weak"}</span><span>{metric.inverse ? "High" : "Strong"}</span></span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {error ? <p className="text-sm text-rose-300">{error}</p> : <p className="text-xs text-gray-500">The v1 score is a transparent triage aid; owner judgment remains final.</p>}
            <button type="submit" className="silhat-btn silhat-btn-primary px-5 py-2">Assess against portfolio</button>
          </div>
        </form>
      ) : null}

      <div className="divide-y divide-gray-800">
        {signals.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-500">No external signals captured yet.</div>
        ) : signals.map((signal) => (
          <article key={signal.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${RECOMMENDATION_TONE[signal.recommendation]}`}>{signal.recommendation}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{signal.signal_type.replace("-", " ")} · {signal.confidence}% confidence</span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-gray-100">{signal.problem}</h3>
                <p className="mt-1 text-sm text-gray-400">For {signal.audience}</p>
                <p className="mt-2 truncate text-xs text-gray-600">Source: {signal.source}</p>
              </div>
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`recommendation-${signal.id}`}>Recommendation</label>
                <select id={`recommendation-${signal.id}`} className="rounded-lg border border-gray-800 bg-gray-950 px-2 py-1.5 text-xs text-gray-300" value={signal.recommendation} onChange={(event) => actions.updateExternalSignal(signal.id, { recommendation: event.target.value as RadarRecommendation })}>
                  {RADAR_RECOMMENDATIONS.map((recommendation) => <option key={recommendation}>{recommendation}</option>)}
                </select>
                <button type="button" className="rounded-lg border border-gray-800 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-300" onClick={() => actions.updateExternalSignal(signal.id, { status: signal.status === "archived" ? "triaged" : "archived" })}>{signal.status === "archived" ? "Restore" : "Archive"}</button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] text-gray-500 sm:grid-cols-6">
              {METRICS.map((metric) => <div key={metric.key} className="rounded border border-gray-800 bg-gray-950 px-2 py-2"><strong className="block text-sm text-gray-300">{signal[metric.key as keyof typeof signal] as number}/5</strong>{metric.label}</div>)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
