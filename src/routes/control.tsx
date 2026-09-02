import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AuthProvider } from "~/lib/useAuth";
import { StoreProvider } from "~/lib/useStore";
import AppShell from "~/components/AppShell";
import GuidedOnboarding from "~/components/GuidedOnboarding";
import { getAgentControl } from "~/lib/control-query";
import { leaderReason } from "~/lib/control-scoring";
import type { ModeledWorkspace } from "~/lib/control-scoring";
import { ageLabelObs } from "~/lib/observations";
import { buildWorkItem, compileDirectives } from "~/lib/directives";
import type { CompiledDirectives, WorkItem } from "~/lib/directives";

export const Route = createFileRoute("/control")({
  loader: async () => getAgentControl(),
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="control">
          <Control />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

const portfolioTone: Record<string, string> = {
  ACTIVE: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  "NEEDS ATTENTION": "border-amber-500/25 bg-amber-500/10 text-amber-300",
  STALE: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  BLOCKED: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  HEALTHY: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  "NEEDS ASSESSMENT": "border-gray-700 bg-gray-900 text-gray-400",
  PAUSED: "border-gray-700 bg-gray-900 text-gray-500",
};

function Chip({ children, className = "border-gray-700 bg-gray-900 text-gray-400" }: { children: React.ReactNode; className?: string }) {
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${className}`}>{children}</span>;
}

function SyncScanButton({ url }: { url: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!url) {
    return <p className="mt-3 text-xs text-gray-600">Add a production URL to this product before running production verification.</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch(`/api/scan-site?url=${encodeURIComponent(url)}`);
            const result = (await response.json()) as { ok?: boolean };
            setMessage(result.ok === false ? "Scan completed; production could not be fully verified." : "Production evidence refreshed.");
            await router.invalidate();
          } catch {
            setMessage("Production scan unavailable. Existing evidence was preserved.");
          } finally {
            setBusy(false);
          }
        }}
        className="silhat-btn silhat-btn-primary disabled:opacity-50"
      >
        {busy ? "Scanning…" : "Verify production"}
      </button>
      <span className="text-[10px] uppercase tracking-wider text-gray-600">saved only to the signed-in account when this URL belongs to its portfolio</span>
      {message && <span className="text-xs text-[#9cc8ff]">{message}</span>}
    </div>
  );
}

function ProductCard({ modeled, now }: { modeled: ModeledWorkspace; now: number }) {
  const ws = modeled.ws;
  return (
    <article className="silhat-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="silhat-eyebrow">{ws.stage}</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-100">{ws.name}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">{ws.summary}</p>
          {ws.url && <a href={ws.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs font-semibold text-[#7fb0ff] hover:underline">{ws.url}</a>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip className={portfolioTone[ws.portfolioState] ?? portfolioTone.ACTIVE}>{ws.portfolioState}</Chip>
          <Chip>priority {modeled.priority}</Chip>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-950/55 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-600">Readiness</p>
          <p className="mt-1 font-semibold text-gray-200">{modeled.readiness == null ? "Needs assessment" : `${modeled.readiness}%`}</p>
          <p className="mt-1 text-[11px] text-gray-600">No percentage is invented from account age or activity.</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950/55 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-600">Production evidence</p>
          <p className="mt-1 font-semibold text-gray-200">{modeled.scan ? ageLabelObs(now, modeled.scan.scannedAt) : "Not observed"}</p>
          <p className="mt-1 text-[11px] text-gray-600">{modeled.scan ? `${modeled.scan.totalFailures} current scan finding${modeled.scan.totalFailures === 1 ? "" : "s"}` : "Run verification to establish current site evidence."}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950/55 p-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-600">Capacity evidence</p>
          <p className="mt-1 font-semibold text-gray-200">{modeled.live?.cap != null ? `${modeled.live.cap}% observed` : modeled.live ? "Observed; no % detected" : "Unknown"}</p>
          <p className="mt-1 text-[11px] text-gray-600">No observation means unknown; it never means available or reserved.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Open evidence-backed work</p>
          {modeled.blockers.length === 0 ? <p className="mt-2 text-sm text-gray-500">No unresolved product work is recorded.</p> : <ul className="mt-2 space-y-2">{modeled.blockers.slice(0, 8).map((blocker) => <li key={blocker.id} className="rounded-lg border border-gray-800 bg-gray-950/55 px-3 py-2 text-sm text-gray-300"><span className="mr-2 text-[10px] uppercase tracking-wider text-gray-600">{blocker.severity}</span>{blocker.title}</li>)}</ul>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-600">Suggested next actions</p>
          {modeled.nextActions.length === 0 ? <p className="mt-2 text-sm text-gray-500">Nothing is auto-scheduled. Create or approve work before handoff.</p> : <ol className="mt-2 space-y-2">{modeled.nextActions.slice(0, 6).map((action, index) => <li key={action.id} className="rounded-lg border border-gray-800 bg-gray-950/55 px-3 py-2"><p className="text-sm font-medium text-gray-200">{index + 1}. {action.title}</p><p className="mt-1 text-[11px] text-gray-600">{action.role} · {action.window}</p></li>)}</ol>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-4">
        <Link to="/product/$productId" params={{ productId: ws.id }} className="silhat-btn silhat-btn-ghost">Open Product Cockpit</Link>
        <SyncScanButton url={ws.url} />
      </div>
    </article>
  );
}

type DirectTab = "markdown" | "json" | "tools" | "toon";

function DirectivePanel({ item, compiled }: { item: WorkItem; compiled: CompiledDirectives }) {
  const [tab, setTab] = useState<DirectTab>("markdown");
  const [copied, setCopied] = useState(false);
  const tabs: Array<{ id: DirectTab; label: string }> = [
    { id: "markdown", label: "Markdown" },
    { id: "json", label: "JSON" },
    { id: "tools", label: "Tool schema" },
    { id: "toon", label: "TOON" },
  ];
  return (
    <section className="mt-4 rounded-xl border border-[#7fb0ff]/20 bg-gray-950/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="silhat-eyebrow">Prepared direction · not execution</p><h3 className="mt-1 text-sm font-semibold text-gray-100">{item.title}</h3></div>
        <Chip>{item.evidenceBasis}</Chip>
      </div>
      <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-xs leading-5 text-amber-100/90">{item.capacity.framing}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">{tabs.map((entry) => <button key={entry.id} type="button" onClick={() => setTab(entry.id)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${tab === entry.id ? "bg-[#7fb0ff]/15 text-[#9cc8ff]" : "bg-gray-900 text-gray-500"}`}>{entry.label}</button>)}</div>
      <pre className="silhat-terminal mt-2 max-h-72 overflow-auto whitespace-pre-wrap p-3 text-xs leading-relaxed">{compiled[tab]}</pre>
      <button type="button" className="silhat-btn silhat-btn-primary mt-3" onClick={async () => { try { await navigator.clipboard.writeText(compiled[tab]); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy directive"}</button>
    </section>
  );
}

function ControlLoginRequired() {
  return <section className="silhat-panel mx-auto max-w-xl p-8 text-center"><p className="silhat-eyebrow">Agent Direct</p><h1 className="mt-2 text-2xl font-bold text-gray-50">Log in to open your governed-action handoff</h1><p className="mt-2 text-sm leading-6 text-gray-400">Authenticated Direct is built only from that account's saved portfolio and tenant-scoped evidence.</p><Link to="/login" className="silhat-btn silhat-btn-primary mt-5 inline-flex">Log in</Link></section>;
}

function Control() {
  const data = Route.useLoaderData();
  const now = data?.modeledAt ?? Date.now();
  const demo = !data?.authenticated && !!data?.demo;
  if (!demo && !data?.authenticated) return <ControlLoginRequired />;

  const portfolio = useMemo(() => data?.portfolio ?? [], [data]);
  const top = portfolio[0];
  const directItem = useMemo(() => top ? buildWorkItem(top, now, { bucket: null }) : null, [top, now]);
  const compiled = useMemo(() => directItem ? compileDirectives(directItem) : null, [directItem]);
  const [directOpen, setDirectOpen] = useState(false);

  return (
    <div className="space-y-6">
      {demo && <section className="rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-4 text-sm text-amber-100"><strong>Demo · synthetic data.</strong> This portfolio is fictional and contains no signed-in user's products.</section>}

      <section className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="silhat-eyebrow">Agent Direct · governed handoff</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">What deserves action next?</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Direct ranks the current account's products and packages approved work for the external Agent OS / Workforce. It does not grant authorization, reserve capacity, or execute work itself.</p></div>
        <div className="text-right text-xs text-gray-500"><p>{portfolio.length} account workspace{portfolio.length === 1 ? "" : "s"}</p><p>tenant-scoped evidence only</p></div>
      </section>

      {!demo && top && <GuidedOnboarding top={top} />}

      {!demo && portfolio.length === 0 && <section className="silhat-panel border-dashed p-8 text-center"><h2 className="font-semibold text-gray-200">Your Direct workspace is empty</h2><p className="mt-1 text-sm text-gray-500">Add a product to this account first. No owner seed or another account's portfolio is substituted.</p><Link to="/portfolio" className="silhat-btn silhat-btn-primary mt-4 inline-flex">Open Portfolio</Link></section>}

      {top && <section className="rounded-xl border border-[#7fb0ff]/25 bg-[#7fb0ff]/[0.05] p-5"><p className="silhat-eyebrow">Highest current priority</p><h2 className="mt-1 text-lg font-semibold text-gray-100">{top.ws.name}{top.nextActions[0]?.title ? ` · ${top.nextActions[0].title}` : ""}</h2><p className="mt-2 text-sm leading-6 text-gray-400">{leaderReason(top)}</p><div className="mt-3 flex flex-wrap gap-2">{directItem && compiled && <button type="button" onClick={() => setDirectOpen((value) => !value)} className="silhat-btn silhat-btn-primary">{directOpen ? "Close prepared direction" : "Prepare direction"}</button>}<Link to="/product/$productId" params={{ productId: top.ws.id }} className="silhat-btn silhat-btn-ghost">Review evidence</Link></div>{directOpen && directItem && compiled && <DirectivePanel item={directItem} compiled={compiled} />}</section>}

      <div className="grid gap-5 xl:grid-cols-2">{portfolio.map((modeled) => <ProductCard key={modeled.ws.id} modeled={modeled} now={now} />)}</div>

      {!demo && <section className="silhat-panel p-5"><p className="silhat-eyebrow">Tenant boundary</p><h2 className="mt-1 text-lg font-semibold text-gray-100">Evidence belongs to the account that supplied it</h2><p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">Production scans are persisted only when the scanned hostname belongs to a product in this signed-in portfolio. Availability sync is authenticated and tenant-scoped. No capacity observation is interpreted as availability, and no static founder portfolio is used as a fallback.</p></section>}
    </div>
  );
}
