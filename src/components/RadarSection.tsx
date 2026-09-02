import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "~/lib/useStore";
import { loadState } from "~/lib/store";
import { startSolutionWorkflow } from "~/lib/solution-workflow";
import {
  RADAR_DISPOSITIONS,
  effectiveRadarDisposition,
  type RadarDisposition,
  type RadarDraft,
  type RadarSignal,
  type RadarSignalType,
} from "~/lib/radar";

const DEFAULT_DRAFT: RadarDraft = {
  inputMode: "url",
  source: "",
  sourceUrl: "",
  signalType: "opportunity",
  problem: "",
  audience: "",
  evidence: "",
  marketMomentum: 3,
  portfolioAdjacency: 3,
  founderFit: 3,
  existingLeverage: 3,
  executionCost: 3,
  strategicRisk: 2,
};

const SCORE_FIELDS: Array<{ key: keyof Pick<RadarDraft, "marketMomentum" | "portfolioAdjacency" | "founderFit" | "existingLeverage" | "executionCost" | "strategicRisk">; label: string }> = [
  { key: "marketMomentum", label: "Market momentum" },
  { key: "portfolioAdjacency", label: "Portfolio adjacency" },
  { key: "founderFit", label: "Founder fit" },
  { key: "existingLeverage", label: "Existing leverage" },
  { key: "executionCost", label: "Execution cost" },
  { key: "strategicRisk", label: "Strategic risk" },
];

const dispositionTone: Record<RadarDisposition, string> = {
  ABSORB: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  EXTEND: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  EXPERIMENT: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  WATCH: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  SPIN_OUT: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  REJECT: "border-gray-700 bg-gray-900 text-gray-400",
};

export default function RadarSection() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [signals, setSignals] = useState<RadarSignal[]>([]);
  const [draft, setDraft] = useState<RadarDraft>(DEFAULT_DRAFT);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    try {
      const response = await fetch("/api/radar", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { signals?: RadarSignal[] };
      setSignals(Array.isArray(data.signals) ? data.signals : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const active = useMemo(() => signals.filter((signal) => signal.status === "active"), [signals]);
  const archived = useMemo(() => signals.filter((signal) => signal.status === "archived"), [signals]);

  const setField = <K extends keyof RadarDraft>(key: K, value: RadarDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/radar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = (await response.json().catch(() => ({}))) as { signal?: RadarSignal; error?: string };
    if (!response.ok || !data.signal) {
      setMessage(data.error ?? "RADAR signal could not be saved.");
      return;
    }
    setSignals((current) => [data.signal!, ...current]);
    setDraft(DEFAULT_DRAFT);
    setOpen(false);
    setMessage("Signal captured. The score is triage evidence, not an automatic product decision.");
  };

  const patch = async (signal: RadarSignal, next: { ownerDisposition?: RadarDisposition | null; productId?: string | null; status?: "active" | "archived" }) => {
    const response = await fetch("/api/radar", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: signal.id, ...next }),
    });
    const data = (await response.json().catch(() => ({}))) as { signal?: RadarSignal; error?: string };
    if (!response.ok || !data.signal) {
      setMessage(data.error ?? "RADAR decision could not be saved.");
      return;
    }
    setSignals((current) => current.map((item) => item.id === signal.id ? data.signal! : item));
  };

  const routeIntoProduct = (signal: RadarSignal) => {
    const product = state.products.find((candidate) => candidate.id === signal.productId);
    if (!product) {
      setMessage("Choose a natural owner product before creating product work.");
      return;
    }
    const disposition = effectiveRadarDisposition(signal);
    if (disposition === "REJECT" || disposition === "WATCH" || disposition === "SPIN_OUT") {
      setMessage(`${disposition.replace("_", " ")} is a portfolio decision, not an instruction to create work inside ${product.name}.`);
      return;
    }
    const createdAt = Date.now();
    actions.addItem({
      productId: product.id,
      type: disposition === "EXTEND" ? "feature" : "issue",
      title: signal.problem,
      description: `RADAR ${signal.signalType} from ${signal.source}. Audience: ${signal.audience}. Evidence: ${signal.evidence.join(" | ")}${signal.sourceUrl ? ` Source: ${signal.sourceUrl}` : ""}`,
      status: "open",
    });
    const created = loadState().items
      .filter((item) => item.productId === product.id && item.title === signal.problem && item.createdAt >= createdAt - 1000)
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (created) startSolutionWorkflow(product, created);
    setMessage(`Routed into ${product.name}. The RADAR evidence remains preserved separately from the resulting work item.`);
    void navigate({ to: "/product/$productId", params: { productId: product.id }, hash: "solution-workflow" });
  };

  return (
    <section className="silhat-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 p-5">
        <div>
          <p className="silhat-eyebrow">RADAR · market / opportunity intelligence</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-50">What changed outside the portfolio?</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Capture customer, category, competitor, capability, or market signals and assess how they relate to what you already own. RADAR signals are not GitHub/Vercel operational evidence and they do not generate ventures automatically.</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className="silhat-btn silhat-btn-primary">{open ? "Close" : "+ Add external signal"}</button>
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-5 bg-gray-950/40 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-xs font-medium text-gray-400">Capture mode<select className="silhat-input mt-1" value={draft.inputMode} onChange={(e) => setField("inputMode", e.target.value as RadarDraft["inputMode"])}><option value="url">URL</option><option value="text">Text</option><option value="manual">Manual</option></select></label>
            <label className="text-xs font-medium text-gray-400">Source<input className="silhat-input mt-1" value={draft.source} onChange={(e) => setField("source", e.target.value)} placeholder="IdeaBrowser, customer call, research…" /></label>
            <label className="text-xs font-medium text-gray-400">Source URL · optional<input className="silhat-input mt-1" value={draft.sourceUrl ?? ""} onChange={(e) => setField("sourceUrl", e.target.value)} placeholder="https://…" /></label>
            <label className="text-xs font-medium text-gray-400">Signal type<select className="silhat-input mt-1" value={draft.signalType} onChange={(e) => setField("signalType", e.target.value as RadarSignalType)}><option value="opportunity">Opportunity</option><option value="risk">Risk</option><option value="trend">Trend</option><option value="customer-pain">Customer pain</option><option value="capability">Capability</option></select></label>
            <label className="text-xs font-medium text-gray-400 md:col-span-2">Problem observed<input className="silhat-input mt-1" value={draft.problem} onChange={(e) => setField("problem", e.target.value)} placeholder="What underlying problem or change does this reveal?" /></label>
            <label className="text-xs font-medium text-gray-400 md:col-span-2">Audience<input className="silhat-input mt-1" value={draft.audience} onChange={(e) => setField("audience", e.target.value)} placeholder="Who experiences it?" /></label>
            <label className="text-xs font-medium text-gray-400">Natural owner · optional<select className="silhat-input mt-1" value={draft.productId ?? ""} onChange={(e) => setField("productId", e.target.value)}><option value="">Portfolio-level / unassigned</option>{state.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
            <label className="text-xs font-medium text-gray-400 md:col-span-3">Evidence · one item per line<textarea className="silhat-input mt-1 min-h-24" value={draft.evidence as string} onChange={(e) => setField("evidence", e.target.value)} placeholder="Customer language, observed demand, category movement, source-specific facts…" /></label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{SCORE_FIELDS.map((field) => <label key={field.key} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3 text-xs font-medium text-gray-400"><span className="flex justify-between"><span>{field.label}</span><strong className="text-gray-200">{draft[field.key]}/5</strong></span><input type="range" min="0" max="5" step="1" className="mt-3 w-full accent-[#7fb0ff]" value={draft[field.key]} onChange={(e) => setField(field.key, Number(e.target.value))} aria-label={field.label} /></label>)}</div>
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500">Scoring is transparent triage. Owner judgment remains final.</p><button type="submit" className="silhat-btn silhat-btn-primary">Assess against portfolio</button></div>
        </form>
      )}

      {message && <p className="mx-5 mt-4 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-xs leading-5 text-gray-300">{message}</p>}

      <div className="divide-y divide-gray-800">
        {loading ? <div className="p-5 text-sm text-gray-500">Loading RADAR…</div> : active.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">No active external market signals yet.</div> : active.map((signal) => {
          const effective = effectiveRadarDisposition(signal);
          const owner = state.products.find((product) => product.id === signal.productId);
          return <article key={signal.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${dispositionTone[effective]}`}>{effective.replace("_", " ")}</span><span className="text-[10px] uppercase tracking-wider text-gray-500">computed {signal.computedDisposition.replace("_", " ")} · score {signal.score}/100 · {signal.signalType.replace("-", " ")}</span>{signal.ownerDisposition && <span className="text-[10px] uppercase tracking-wider text-[#9cc8ff]">owner override</span>}</div><h3 className="mt-2 text-base font-semibold text-gray-100">{signal.problem}</h3><p className="mt-1 text-sm text-gray-400">For {signal.audience}</p><p className="mt-2 text-xs text-gray-600">Source: {signal.source}{signal.sourceUrl ? " · linked" : ""}</p></div>
              <button type="button" onClick={() => void patch(signal, { status: "archived" })} className="text-xs font-semibold text-gray-600 hover:text-gray-300">Archive</button>
            </div>
            {signal.evidence.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-gray-500">{signal.evidence.slice(0, 4).map((item, index) => <li key={`${signal.id}:${index}`}>{item}</li>)}</ul>}
            <div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-[11px] uppercase tracking-wider text-gray-600">Natural owner<select className="silhat-input mt-1 normal-case tracking-normal" value={signal.productId ?? ""} onChange={(e) => void patch(signal, { productId: e.target.value || null })}><option value="">Unassigned</option>{state.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="text-[11px] uppercase tracking-wider text-gray-600">Owner disposition<select className="silhat-input mt-1 normal-case tracking-normal" value={signal.ownerDisposition ?? ""} onChange={(e) => void patch(signal, { ownerDisposition: (e.target.value || null) as RadarDisposition | null })}><option value="">Use computed recommendation</option>{RADAR_DISPOSITIONS.map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></label></div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3"><p className="text-xs text-gray-500">Computed guidance remains preserved even when you override it.</p>{owner && !["WATCH", "REJECT", "SPIN_OUT"].includes(effective) && <button type="button" onClick={() => routeIntoProduct(signal)} className="text-xs font-semibold text-[#7fb0ff] hover:underline">Route into {owner.name} →</button>}</div>
          </article>;
        })}
      </div>
      {archived.length > 0 && <div className="border-t border-gray-800 p-4 text-xs text-gray-500">{archived.length} archived signal{archived.length === 1 ? "" : "s"}. <button type="button" className="font-semibold text-gray-300 hover:underline" onClick={() => void patch(archived[0], { status: "active" })}>Restore most recent</button></div>}
      <p className="border-t border-gray-800 px-5 py-3 text-[11px] leading-5 text-gray-600">Manual URL/text capture is live. Automated IdeaBrowser or market-provider ingestion is not claimed.</p>
    </section>
  );
}
