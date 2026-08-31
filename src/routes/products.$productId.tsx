import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import AppShell from "~/components/AppShell";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider, useStore } from "~/lib/useStore";
import { assessProductRetirement } from "~/lib/portfolio-lifecycle";
import { timeAgo } from "~/lib/observation";
import {
  DECISION_DISPOSITIONS,
  platformLabel,
  type DecisionDisposition,
  type ProductDecision,
} from "~/lib/store";

export const Route = createFileRoute("/products/$productId")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="decisions"><ProductReview /></AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

const LABEL: Record<DecisionDisposition, string> = {
  "not-decisioned": "Not decisioned",
  deployed: "Deployed",
  "paused-for-timing": "Paused for timing",
  deferred: "Deferred",
};

function DecisionRow({ decision, onChange }: {
  decision: ProductDecision;
  onChange: (disposition: DecisionDisposition, reason?: string) => void;
}) {
  const [reason, setReason] = useState(decision.reason ?? "");
  return (
    <li className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-100">{decision.title}</p>
        <select
          aria-label={`Decision for ${decision.title}`}
          value={decision.disposition}
          onChange={(event) => onChange(event.target.value as DecisionDisposition, reason)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-200"
        >
          {DECISION_DISPOSITIONS.map((value) => <option key={value} value={value}>{LABEL[value]}</option>)}
        </select>
      </div>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        onBlur={() => onChange(decision.disposition, reason)}
        placeholder="Reason or outcome evidence (optional)"
        className="mt-3 w-full rounded-lg border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600"
      />
    </li>
  );
}

function ProductReview() {
  const { productId } = Route.useParams();
  const { loading, user } = useAuth();
  const { state, ready, actions } = useStore();
  const product = state.products.find((entry) => entry.id === productId);
  const items = useMemo(() => state.items.filter((item) => item.productId === productId), [state.items, productId]);
  const openItems = items.filter((item) => item.status !== "done");
  const decisions = (state.decisions ?? {})[productId] ?? [];
  const opportunities = (state.opportunities ?? []).filter((opportunity) => opportunity.productId === productId);
  const scanHistory = state.scanHistory?.[productId];
  const engagement = state.engagement?.[productId];
  const assessment = product ? assessProductRetirement(state, product) : null;

  if (loading || !ready) return <p className="py-20 text-center text-gray-500">Loading…</p>;
  if (!user) return <div className="silhat-panel px-6 py-16 text-center"><p className="text-lg font-semibold">Sign in to review this product</p><Link to="/login" className="silhat-btn silhat-btn-primary mt-5 inline-flex rounded-xl px-5 py-2.5">Log in</Link></div>;
  if (!product || !assessment) return <div className="silhat-panel px-6 py-16 text-center"><p className="text-lg font-semibold">Product not found</p><Link to="/portfolio" className="mt-4 inline-block text-cyan-400">Return to portfolio</Link></div>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="silhat-eyebrow">Product · All-up review</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-50">{product.name}</h1>
          <p className="mt-2 text-sm text-gray-400">{platformLabel(product.platform)} · evidence, active work, lifecycle, opportunities, and decisions in one place.</p>
        </div>
        <div className="flex gap-2">
          {product.url && <a href={product.url.startsWith("http") ? product.url : `https://${product.url}`} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300">Open product ↗</a>}
          <Link to="/portfolio" className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-400">Portfolio lifecycle</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="silhat-panel p-4"><p className="silhat-eyebrow">Active work</p><p className="mt-2 text-2xl font-bold">{openItems.length}</p><p className="mt-1 text-xs text-gray-500">{items.length - openItems.length} completed</p></div>
        <div className="silhat-panel p-4"><p className="silhat-eyebrow">Latest observation</p><p className="mt-2 text-sm font-semibold text-gray-200">{scanHistory?.lastGood?.scannedAt ? timeAgo(scanHistory.lastGood.scannedAt) : "No successful scan yet"}</p><p className="mt-1 text-xs text-gray-500">Only observed evidence is reported.</p></div>
        <div className="silhat-panel p-4"><p className="silhat-eyebrow">Engagement</p><p className="mt-2 text-sm font-semibold capitalize text-gray-200">{engagement?.level ?? "Not connected"}</p><p className="mt-1 text-xs text-gray-500">{engagement ? `${engagement.source} · ${timeAgo(engagement.observedAt)}` : "No inference from silence"}</p></div>
        <div className="silhat-panel p-4"><p className="silhat-eyebrow">Lifecycle</p><p className="mt-2 text-sm font-semibold capitalize text-gray-200">{assessment.action === "recommend_retire" ? "Retirement candidate" : assessment.action === "review" ? "Review" : "Active"}</p><p className="mt-1 text-xs text-gray-500">Owner decides; never auto-retired.</p></div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="silhat-panel p-5">
          <p className="silhat-eyebrow">What deserves attention</p>
          <h2 className="mt-1 text-lg font-semibold">Open work and signals</h2>
          {openItems.length ? <ul className="mt-4 space-y-2">{openItems.map((item) => <li key={item.id} className="rounded-lg border border-gray-800 bg-gray-950/60 px-4 py-3"><span className="text-sm font-medium text-gray-200">{item.title}</span><span className="ml-2 text-[10px] uppercase tracking-wide text-gray-500">{item.status.replace("_", " ")} · {item.type}</span></li>)}</ul> : <p className="mt-4 text-sm text-gray-500">No open checklist items for this product.</p>}
        </div>
        <div className="silhat-panel p-5">
          <p className="silhat-eyebrow">Lifecycle intelligence</p>
          <p className="mt-3 text-sm leading-6 text-gray-300">{assessment.reasoning}</p>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-gray-500">{assessment.evidence.map((evidence) => <li key={evidence}>• {evidence}</li>)}</ul>
        </div>
      </section>

      <section className="silhat-panel p-5">
        <p className="silhat-eyebrow">Opportunities</p>
        <h2 className="mt-1 text-lg font-semibold">Observed possibilities</h2>
        {opportunities.length ? <ul className="mt-4 grid gap-3 lg:grid-cols-2">{opportunities.map((opportunity) => <li key={opportunity.id} className="rounded-xl border border-gray-800 bg-gray-950/60 p-4"><p className="text-sm font-semibold text-gray-200">{opportunity.title}</p><p className="mt-2 text-xs leading-5 text-gray-500">{opportunity.description}</p></li>)}</ul> : <p className="mt-4 text-sm text-gray-500">No product-specific opportunities have been observed yet.</p>}
      </section>

      <section className="silhat-panel p-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="silhat-eyebrow">Decisions and outcomes</p><h2 className="mt-1 text-lg font-semibold">What happened to recommended work</h2></div><span className="text-xs text-gray-500">{decisions.length} recorded</span></div>
        {decisions.length ? <ul className="mt-4 space-y-3">{decisions.map((decision) => <DecisionRow key={decision.id} decision={decision} onChange={(disposition, reason) => actions.setDecisionDisposition(productId, decision.id, disposition, reason)} />)}</ul> : <p className="mt-4 text-sm text-gray-500">No recommendations have been decisioned for this product yet.</p>}
      </section>

      <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
        <p className="silhat-eyebrow">Facilitation</p>
        <h2 className="mt-1 text-lg font-semibold">Understand, act, and review</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Use this product’s evidence to build judgment or prepare governed work. Ailhat facilitates the decision; your chosen workforce and harness execute it.</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link to="/learn" className="rounded-lg border border-cyan-700/60 px-3 py-2 text-xs font-semibold text-cyan-300">Teach / guide me</Link><Link to="/control" className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300">Prepare for delegation</Link><Link to="/brief" className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300">Review portfolio impact</Link></div>
      </section>
    </div>
  );
}
