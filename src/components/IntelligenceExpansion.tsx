import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "~/lib/useStore";
import { loadState } from "~/lib/store";
import { startSolutionWorkflow } from "~/lib/solution-workflow";

const RADAR_KEY = "ailhat.radar-signals.v1";
const FRESH_SCAN_MS = 7 * 24 * 60 * 60 * 1000;

type RoutingOutcome =
  | "NEW_VENTURE"
  | "FEATURE"
  | "CAPABILITY"
  | "INTEGRATION"
  | "EXPERIMENT"
  | "IGNORE";

interface RadarSignal {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceUrl?: string;
  productId?: string;
  route?: RoutingOutcome;
  createdAt: number;
}

const ROUTE_META: Record<RoutingOutcome, { label: string; description: string }> = {
  CAPABILITY: {
    label: "ABSORB",
    description: "Strengthen an existing product without creating a new offering.",
  },
  FEATURE: {
    label: "EXTEND",
    description: "Add this inside an existing product's current promise.",
  },
  EXPERIMENT: {
    label: "EXPERIMENT",
    description: "Validate the opportunity before committing product surface area.",
  },
  INTEGRATION: {
    label: "WATCH / CONNECT",
    description: "Capture the value through an external system or source connection.",
  },
  NEW_VENTURE: {
    label: "SPIN OUT",
    description: "Potentially distinct enough to become a separate venture after validation.",
  },
  IGNORE: {
    label: "REJECT",
    description: "Weak fit, redundant, distracting, or insufficiently evidenced.",
  },
};

function loadRadar(): RadarSignal[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RADAR_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as RadarSignal[]) : [];
  } catch {
    return [];
  }
}

function saveRadar(items: RadarSignal[]) {
  try {
    window.localStorage.setItem(RADAR_KEY, JSON.stringify(items.slice(0, 60)));
  } catch {
    // RADAR is facilitation state only. Portfolio evidence remains untouched.
  }
}

export default function IntelligenceExpansion() {
  const { state, actions } = useStore();
  const navigate = useNavigate();
  const [signals, setSignals] = useState<RadarSignal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [source, setSource] = useState("IdeaBrowser");
  const [sourceUrl, setSourceUrl] = useState("");
  const [productId, setProductId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => setSignals(loadRadar()), []);

  const activeSignals = useMemo(
    () => [...signals].sort((a, b) => b.createdAt - a.createdAt),
    [signals],
  );

  const addSignal = () => {
    if (!title.trim() || !summary.trim() || !source.trim()) return;
    const next: RadarSignal[] = [
      {
        id: `radar:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        title: title.trim(),
        summary: summary.trim(),
        source: source.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
        productId: productId || undefined,
        createdAt: Date.now(),
      },
      ...signals,
    ];
    setSignals(next);
    saveRadar(next);
    setTitle("");
    setSummary("");
    setSourceUrl("");
    setMessage("Signal added to RADAR. It remains unrouted until you choose an evidence-backed disposition.");
    setShowForm(false);
  };

  const routeSignal = (id: string, route: RoutingOutcome) => {
    const next = signals.map((signal) => (signal.id === id ? { ...signal, route } : signal));
    setSignals(next);
    saveRadar(next);
    setMessage(`${ROUTE_META[route].label} recorded as the current routing decision.`);
  };

  const moveIntoProduct = (signal: RadarSignal) => {
    const product = state.products.find((p) => p.id === signal.productId);
    if (!product) {
      setMessage("Choose a natural owner product before routing this signal into product work.");
      return;
    }

    const routedAt = Date.now();
    actions.addItem({
      productId: product.id,
      type: signal.route === "FEATURE" ? "feature" : "issue",
      title: signal.title,
      description: `External opportunity signal from ${signal.source}. ${signal.summary}${signal.sourceUrl ? ` Source: ${signal.sourceUrl}` : ""}`,
      status: "open",
    });

    const createdItem = loadState().items
      .filter(
        (item) =>
          item.productId === product.id &&
          item.title === signal.title &&
          item.createdAt >= routedAt - 1000,
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0];

    if (createdItem) {
      startSolutionWorkflow(product, createdItem);
      setMessage(`Added to ${product.name} and opened as an external-opportunity solution workflow.`);
    } else {
      setMessage(`Added to ${product.name}. Opening its Product Cockpit to continue the work.`);
    }

    void navigate({
      to: "/product/$productId",
      params: { productId: product.id },
      hash: "solution-workflow",
    });
  };

  const setOwner = (id: string, nextProductId: string) => {
    const next = signals.map((signal) =>
      signal.id === id ? { ...signal, productId: nextProductId || undefined } : signal,
    );
    setSignals(next);
    saveRadar(next);
  };

  return (
    <div className="space-y-6">
      <section className="silhat-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="silhat-eyebrow">RADAR · external opportunity intelligence</p>
            <h2 className="mt-1 text-xl font-semibold text-gray-100">What should this idea become inside your portfolio?</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-500">
              Bring in an IdeaBrowser insight, market observation, customer problem, competitor pattern, or founder note. ailhat preserves the source and routes the opportunity before you create more product surface area.
            </p>
          </div>
          <button type="button" onClick={() => setShowForm((value) => !value)} className="silhat-btn silhat-btn-primary">
            {showForm ? "Close" : "Add external signal"}
          </button>
        </div>

        {showForm && (
          <div className="mt-5 grid gap-3 rounded-xl border border-gray-800 bg-gray-950/60 p-4 lg:grid-cols-2">
            <label className="text-xs font-semibold text-gray-400">
              Signal title
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="silhat-input mt-1" placeholder="e.g. Agent-ready website audits" />
            </label>
            <label className="text-xs font-semibold text-gray-400">
              Source
              <input value={source} onChange={(e) => setSource(e.target.value)} className="silhat-input mt-1" placeholder="IdeaBrowser, customer call, research…" />
            </label>
            <label className="text-xs font-semibold text-gray-400 lg:col-span-2">
              Evidence / why it matters
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="silhat-input mt-1 min-h-24" placeholder="Paste the core insight, observed demand, problem, or evidence. Do not summarize it as fact unless the source supports it." />
            </label>
            <label className="text-xs font-semibold text-gray-400">
              Source URL · optional
              <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="silhat-input mt-1" placeholder="https://…" />
            </label>
            <label className="text-xs font-semibold text-gray-400">
              Natural owner · optional
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className="silhat-input mt-1">
                <option value="">Unassigned / portfolio-level</option>
                {state.products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </select>
            </label>
            <div className="lg:col-span-2 flex flex-wrap items-center gap-3">
              <button type="button" onClick={addSignal} className="silhat-btn silhat-btn-primary" disabled={!title.trim() || !summary.trim() || !source.trim()}>
                Add to RADAR
              </button>
              <span className="text-[11px] text-gray-600">Manual ingestion is real; automated IdeaBrowser API ingestion is not claimed.</span>
            </div>
          </div>
        )}

        {activeSignals.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-gray-800 px-5 py-8 text-center">
            <p className="text-sm font-semibold text-gray-300">No external opportunity signals yet</p>
            <p className="mt-1 text-xs text-gray-600">Add one from IdeaBrowser or another source; ailhat will keep the source attached while you route it.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {activeSignals.slice(0, 8).map((signal) => {
              const owner = state.products.find((p) => p.id === signal.productId);
              return (
                <article key={signal.id} className="rounded-xl border border-gray-800 bg-gray-950/55 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-gray-600">
                        <span>{signal.source}</span>
                        <span>·</span>
                        <span>{new Date(signal.createdAt).toLocaleDateString()}</span>
                        {signal.route && (
                          <span className="rounded-full border border-[#7fb0ff]/25 bg-[#7fb0ff]/10 px-2 py-0.5 font-semibold text-[#7fb0ff]">
                            {ROUTE_META[signal.route].label}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-gray-100">{signal.title}</h3>
                      <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-500">{signal.summary}</p>
                      {signal.sourceUrl && (
                        <a href={signal.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-[#7fb0ff] hover:underline">Open source ↗</a>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                      Natural owner
                      <select value={signal.productId ?? ""} onChange={(e) => setOwner(signal.id, e.target.value)} className="silhat-input mt-1 normal-case tracking-normal">
                        <option value="">Unassigned</option>
                        {state.products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">Opportunity routing</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {(Object.keys(ROUTE_META) as RoutingOutcome[]).map((route) => (
                          <button key={route} type="button" onClick={() => routeSignal(signal.id, route)} title={ROUTE_META[route].description} className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold ${signal.route === route ? "border-[#7fb0ff]/45 bg-[#7fb0ff]/10 text-[#7fb0ff]" : "border-gray-800 text-gray-500 hover:text-gray-300"}`}>
                            {ROUTE_META[route].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {signal.route && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3">
                      <p className="text-xs text-gray-500">{ROUTE_META[signal.route].description}</p>
                      {owner && signal.route !== "IGNORE" && signal.route !== "NEW_VENTURE" && (
                        <button type="button" onClick={() => moveIntoProduct(signal)} className="text-xs font-semibold text-[#7fb0ff] hover:underline">
                          Route into {owner.name} →
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="silhat-panel p-5">
        <div>
          <p className="silhat-eyebrow">Launch Readiness · evidence coverage</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-100">Is the portfolio actually ready to receive users?</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-500">
            Readiness is derived only from evidence ailhat currently has. Unknown checks remain unknown; a successful deployment or clean basic scan is not presented as proof that auth, forms, analytics, mobile journeys, accessibility, or conversion paths all work.
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
                  ? "Needs evidence"
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
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                    <EvidenceCell label="URL" value={product.url ? "Present" : "Missing"} />
                    <EvidenceCell label="Successful scan" value={lastGood ? "Present" : "Missing"} />
                    <EvidenceCell label="Active findings" value={String(presentFindings.length)} />
                    <EvidenceCell label="Open work" value={String(openWork.length)} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-800 pt-3">
                    <p className="text-[11px] leading-5 text-gray-600">
                      {lastGood ? `${fresh ? "Fresh" : "Stale"} scan evidence · ${new Date(lastGood.scannedAt).toLocaleString()}` : "No successful scan evidence recorded yet."}
                    </p>
                    <Link to="/product/$productId" params={{ productId: product.id }} className="text-xs font-semibold text-[#7fb0ff] hover:underline">
                      Open readiness in Product Cockpit →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {message && (
        <div className="rounded-lg border border-[#7fb0ff]/20 bg-[#7fb0ff]/5 px-4 py-3 text-sm text-gray-300">
          {message}
        </div>
      )}
    </div>
  );
}

function EvidenceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-600">{label}</p>
      <p className="mt-1 font-semibold text-gray-300">{value}</p>
    </div>
  );
}
