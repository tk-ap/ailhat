import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import AppShell from "~/components/AppShell";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider, useStore } from "~/lib/useStore";
import { computeBrief, type Signal } from "~/lib/brief";
import { assessPortfolioRetirement } from "~/lib/portfolio-lifecycle";
import { scanSite } from "~/lib/scanClient";
import { platformLabel } from "~/lib/store";
import { timeAgo } from "~/lib/observation";
import {
  effectiveFindingDisplay,
  findingLifecycleLabel,
  loadFindingVisibility,
  saveFindingVisibility,
  setFindingDisplayPreference,
  type FindingDisplayPreference,
  type FindingVisibilityState,
} from "~/lib/finding-visibility";
import { buildSignalWorkItem, type SignalWorkMode } from "~/lib/signal-work-item";
import { savePreparedWorkItem } from "~/lib/prepared-work";

export const Route = createFileRoute("/product/$productId")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="portfolio">
          <ProductCockpit />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

function ProductCockpit() {
  const { productId } = Route.useParams();
  const { user, loading } = useAuth();
  const { state, ready, actions } = useStore();
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [prepareMessage, setPrepareMessage] = useState("");
  const [findingVisibility, setFindingVisibility] = useState<FindingVisibilityState>({});
  const [showHiddenFindings, setShowHiddenFindings] = useState(false);

  useEffect(() => {
    setFindingVisibility(loadFindingVisibility());
  }, []);

  const product = state.products.find((p) => p.id === productId);
  const items = state.items.filter((i) => i.productId === productId);
  const openItems = items.filter((i) => i.status !== "done");
  const signals = useMemo(
    () => computeBrief(state).filter((s) => s.productId === productId),
    [state, productId],
  );
  const opportunities = (state.opportunities ?? []).filter((o) => o.productId === productId);
  const decisions = state.decisions?.[productId] ?? [];
  const history = state.scanHistory?.[productId];
  const lastGood = history?.lastGood;
  const engagement = state.engagement?.[productId];
  const lifecycle = useMemo(
    () => assessPortfolioRetirement(state).find((a) => a.productId === productId),
    [state, productId],
  );
  const trackedIssues = useMemo(
    () =>
      Object.values(history?.issues ?? {}).sort((a, b) => {
        if (a.present !== b.present) return a.present ? -1 : 1;
        if (a.present && a.timesResolved !== b.timesResolved) return b.timesResolved - a.timesResolved;
        return b.lastDetectedAt - a.lastDetectedAt;
      }),
    [history],
  );

  const hiddenResolvedCount = trackedIssues.filter(
    (issue) =>
      !issue.present &&
      effectiveFindingDisplay(findingVisibility, productId, issue) === "hidden",
  ).length;

  const displayedIssues = trackedIssues.filter((issue) => {
    const display = effectiveFindingDisplay(findingVisibility, productId, issue);
    return display !== "hidden" || showHiddenFindings;
  });

  if (loading || !ready) {
    return <p className="py-20 text-center text-gray-500">Loading…</p>;
  }
  if (!user) {
    return <div className="silhat-panel px-6 py-16 text-center text-gray-400">Sign in to open a Product Cockpit.</div>;
  }
  if (!product) {
    return (
      <div className="silhat-panel px-6 py-16 text-center">
        <p className="font-semibold text-gray-100">This product is not in the active portfolio.</p>
        <Link to="/portfolio" className="mt-3 inline-block text-sm font-semibold text-[#7fb0ff] hover:underline">
          Open Portfolio →
        </Link>
      </div>
    );
  }

  const runScan = async () => {
    if (!product.url || scanning) return;
    setScanning(true);
    setScanMessage("");
    try {
      const result = await scanSite(product.url);
      if (result) {
        actions.recordScan(product.id, result);
        setScanMessage(result.ok ? "Fresh evidence recorded. Resolved and regressed findings were reconciled." : "Scan completed, but the site could not be fully verified.");
      } else {
        setScanMessage("Scan service unavailable. Existing evidence was preserved.");
      }
    } finally {
      setScanning(false);
    }
  };

  const prepareSignal = (signal: Signal, mode: SignalWorkMode) => {
    const item = buildSignalWorkItem(signal, mode, Date.now(), product);
    savePreparedWorkItem(item);
    setPrepareMessage(`${mode === "fix" ? "Fix" : "Investigation"} prepared for Direct. The signal remains open until fresh evidence verifies the outcome.`);
  };

  const setFindingPreference = (
    stableKey: string,
    preference: FindingDisplayPreference,
  ) => {
    const next = setFindingDisplayPreference(
      findingVisibility,
      productId,
      stableKey,
      preference,
    );
    setFindingVisibility(next);
    saveFindingVisibility(next);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="silhat-eyebrow">Product Cockpit · active portfolio</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-50">{product.name}</h1>
            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">Active</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{platformLabel(product.platform)}</p>
          {product.url && (
            <a href={product.url.startsWith("http") ? product.url : `https://${product.url}`} target="_blank" rel="noreferrer" className="mt-1 block truncate text-sm text-[#7fb0ff] hover:underline">
              {product.url}
            </a>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void runScan()} disabled={!product.url || scanning} className="silhat-btn silhat-btn-primary">
            {scanning ? "Scanning…" : lastGood ? "Re-scan" : "Scan now"}
          </button>
          <Link to="/brief" className="silhat-btn silhat-btn-ghost">Review intelligence</Link>
          <Link to="/control" className="silhat-btn silhat-btn-ghost">Open Direct</Link>
        </div>
      </section>

      {scanMessage && <div className="rounded-lg border border-[#7fb0ff]/20 bg-[#7fb0ff]/5 px-4 py-3 text-sm text-gray-300">{scanMessage}</div>}
      {prepareMessage && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">{prepareMessage}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Open work" value={String(openItems.length)} detail={`${items.length} total checklist items`} />
        <Metric label="Open signals" value={String(signals.length)} detail={signals[0]?.title ?? "No product-specific signal"} />
        <Metric label="Observation" value={lastGood ? timeAgo(lastGood.scannedAt) : "Not scanned"} detail={history?.consecutiveFailures ? `${history.consecutiveFailures} recent failed attempt${history.consecutiveFailures === 1 ? "" : "s"}` : "fresh evidence closes the loop"} />
        <Metric label="Tracked findings" value={String(trackedIssues.length)} detail={hiddenResolvedCount > 0 ? `${hiddenResolvedCount} resolved finding${hiddenResolvedCount === 1 ? "" : "s"} hidden from active view` : "resolved evidence is preserved"} />
      </section>

      <section className="silhat-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="silhat-eyebrow">Observation history · preserved evidence</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-100">Resolved findings condense; regressions resurface</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              Hiding or condensing is presentation only. Scan history is retained. If a resolved finding fails again, ailhat automatically returns it to the active view as a regression.
            </p>
          </div>
          {hiddenResolvedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHiddenFindings((value) => !value)}
              className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-800"
            >
              {showHiddenFindings ? "Hide hidden history" : `Show hidden (${hiddenResolvedCount})`}
            </button>
          )}
        </div>

        {displayedIssues.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No tracked scan findings yet. Run a scan to establish observation history.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {displayedIssues.map((issue) => {
              const lifecycleLabel = findingLifecycleLabel(issue);
              const display = effectiveFindingDisplay(findingVisibility, productId, issue);
              const isHidden = display === "hidden";
              const condensed = lifecycleLabel === "resolved" && display === "condensed";
              const badge =
                lifecycleLabel === "regressed"
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                  : lifecycleLabel === "active"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
              return (
                <article key={issue.stableKey} className={`rounded-lg border border-gray-800 bg-gray-950/60 p-3 ${isHidden ? "opacity-55" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${badge}`}>
                          {lifecycleLabel}
                        </span>
                        {isHidden && <span className="text-[10px] uppercase tracking-wider text-gray-600">hidden from active view</span>}
                        {condensed && <span className="text-[10px] uppercase tracking-wider text-gray-600">condensed</span>}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-gray-200">{issue.title}</h3>
                      {!condensed && !isHidden && (
                        <>
                          <p className="mt-1 text-sm leading-5 text-gray-500">{issue.detail}</p>
                          <p className="mt-2 text-[11px] text-gray-600">
                            first seen {timeAgo(issue.firstDetectedAt)} · last seen {timeAgo(issue.lastDetectedAt)} · {issue.occurrences} occurrence{issue.occurrences === 1 ? "" : "s"} · resolved {issue.timesResolved} time{issue.timesResolved === 1 ? "" : "s"}
                          </p>
                        </>
                      )}
                      {lifecycleLabel === "regressed" && (
                        <p className="mt-2 text-xs font-medium text-rose-300">Previously resolved; fresh scan evidence shows the condition has returned.</p>
                      )}
                    </div>

                    {lifecycleLabel === "resolved" && (
                      <div className="flex shrink-0 flex-wrap gap-1.5">
                        {isHidden ? (
                          <button type="button" onClick={() => setFindingPreference(issue.stableKey, "condensed")} className="rounded-lg border border-gray-700 px-2.5 py-1 text-[11px] font-semibold text-gray-300 hover:bg-gray-800">
                            Restore
                          </button>
                        ) : (
                          <>
                            <button type="button" onClick={() => setFindingPreference(issue.stableKey, "expanded")} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${display === "expanded" ? "bg-gray-700 text-gray-100" : "border border-gray-700 text-gray-400"}`}>
                              Expand
                            </button>
                            <button type="button" onClick={() => setFindingPreference(issue.stableKey, "condensed")} className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${display === "condensed" ? "bg-gray-700 text-gray-100" : "border border-gray-700 text-gray-400"}`}>
                              Condense
                            </button>
                            <button type="button" onClick={() => setFindingPreference(issue.stableKey, "hidden")} className="rounded-lg border border-gray-700 px-2.5 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-800 hover:text-gray-300">
                              Hide
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <p className="mt-4 border-t border-gray-800 pt-3 text-[11px] leading-5 text-gray-600">
          No delete action is attached to resolution, hiding, or condensation. Permanent deletion remains a separate explicit lifecycle action.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="silhat-panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="silhat-eyebrow">Review · what needs attention</p>
              <h2 className="mt-1 text-lg font-semibold text-gray-100">Signals for {product.name}</h2>
            </div>
            <Link to="/brief" className="text-xs font-semibold text-[#7fb0ff] hover:underline">Open full Intelligence →</Link>
          </div>
          {signals.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No product-specific signal is currently open. Re-scan after a meaningful change to verify the state again.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {signals.slice(0, 5).map((signal) => (
                <article key={signal.id} className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">{signal.level.replace("_", " ")}</span>
                    <span className="text-[10px] text-gray-600">{signal.id}</span>
                  </div>
                  <h3 className="mt-2 font-semibold text-gray-100">{signal.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-gray-400">{signal.summary}</p>
                  <p className="mt-2 text-sm text-gray-300"><span className="font-semibold text-[#7fb0ff]">Next:</span> {signal.action}</p>
                  {signal.level !== "HEALTHY" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => prepareSignal(signal, "fix")} className="rounded-lg bg-[#7fb0ff] px-3 py-1.5 text-xs font-semibold text-[#0a0a0a]">
                        Fix → Direct
                      </button>
                      <button type="button" onClick={() => prepareSignal(signal, "investigate")} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300">
                        Investigate → Direct
                      </button>
                      <Link to="/decisions/$productId" params={{ productId }} className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300">Decisions</Link>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <section className="silhat-panel p-5">
            <p className="silhat-eyebrow">Implement · current work</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-100">Checklist</h2>
            {openItems.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No open checklist work.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {openItems.slice(0, 6).map((item) => (
                  <li key={item.id} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-300">
                    <div className="flex items-start justify-between gap-3">
                      <span>{item.title}</span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wider text-gray-600">{item.status.replace("_", " ")}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/control" className="mt-4 inline-block text-xs font-semibold text-[#7fb0ff] hover:underline">Give / get agent directions →</Link>
          </section>

          <section className="silhat-panel p-5">
            <p className="silhat-eyebrow">Lifecycle · evidence</p>
            <p className="mt-2 text-sm leading-6 text-gray-300">{lifecycle?.reasoning ?? "No lifecycle assessment available yet."}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-gray-400">{decisions.length} decisions</span>
              <span className="rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-gray-400">{opportunities.length} opportunities</span>
              {engagement && <span className="rounded-full border border-gray-800 bg-gray-950 px-2.5 py-1 text-gray-400">{engagement.level} engagement · {engagement.source}</span>}
            </div>
            <Link to="/portfolio" className="mt-4 inline-block text-xs font-semibold text-[#7fb0ff] hover:underline">Portfolio membership / retirement →</Link>
          </section>
        </div>
      </section>

      <section className="rounded-xl border border-[#7fb0ff]/20 bg-[#7fb0ff]/[0.04] p-5">
        <p className="silhat-eyebrow">Close the loop</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-300">
          <span>Scan</span><span className="text-gray-600">→</span><span>Review</span><span className="text-gray-600">→</span><span>Prepare / direct</span><span className="text-gray-600">→</span><span>Execute</span><span className="text-gray-600">→</span><strong className="text-[#7fb0ff]">Re-scan and verify</strong>
        </div>
        <p className="mt-2 text-xs leading-5 text-gray-500">ailhat should not treat an instruction as an outcome. Fresh observation is what confirms whether the work actually changed the product.</p>
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="silhat-panel p-4">
      <p className="silhat-eyebrow">{label}</p>
      <p className="mt-2 truncate text-xl font-bold text-gray-100">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}
