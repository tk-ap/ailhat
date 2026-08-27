// Per-product "Decisions" view — the spot (decided) where the owner records what
// happened to each recommendation the Direct/seed model surfaced for a product.
//
// Pure presentation + owner-entered state. It does NOT rebuild the readiness /
// scoring / directive model. It is ACCOUNT-SCOPED: opened from the authenticated
// shell's portfolio menu; anonymous visitors get a sign-in CTA, never the owner's
// portfolio.
//
// Persistence rides the existing per-user AppState (a new `decisions` field)
// through the existing debounced PUT /api/portfolio — no new tables or routes.
// Honesty: recommendations are seeded from the Direct/seed model and default to
// "not-decisioned" — the app never auto-claims deployed / paused / deferred.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider, useStore } from "~/lib/useStore";
import AppShell from "~/components/AppShell";
import { getDecisionSeeds } from "~/lib/decision-seed";
import type { DecisionSeedRecommendation } from "~/lib/decision-seed";
import {
  DECISION_DISPOSITIONS,
  type DecisionDisposition,
  type ProductDecision,
} from "~/lib/store";

export const Route = createFileRoute("/decisions/$productId")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="decisions">
          <DecisionsView />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

const DISPOSITION_LABEL: Record<DecisionDisposition, string> = {
  "not-decisioned": "Not decisioned",
  deployed: "Deployed",
  "paused-for-timing": "Paused for timing",
  deferred: "Deferred",
};

const DISPOSITION_OPTION_TONE: Record<DecisionDisposition, string> = {
  "not-decisioned": "text-gray-400",
  deployed: "text-emerald-300",
  "paused-for-timing": "text-amber-300",
  deferred: "text-gray-300",
};

function summary(
  list: ProductDecision[],
): Record<DecisionDisposition, number> {
  const out: Record<DecisionDisposition, number> = {
    "not-decisioned": 0,
    deployed: 0,
    "paused-for-timing": 0,
    deferred: 0,
  };
  for (const d of list) {
    // Never count an out-of-enum value as if it were a real disposition.
    if (d && DECISION_DISPOSITIONS.includes(d.disposition)) out[d.disposition] += 1;
  }
  return out;
}

function DecisionRow({
  decision,
  onChange,
}: {
  decision: ProductDecision;
  onChange: (disposition: DecisionDisposition, reason?: string) => void;
}) {
  const [reason, setReason] = useState(decision.reason ?? "");
  const updatedLabel = decision.updatedAt
    ? new Date(decision.updatedAt).toLocaleString()
    : null;

  return (
    <li className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm font-medium text-gray-100">
          {decision.title}
        </p>
        <select
          aria-label="Disposition"
          value={decision.disposition}
          onChange={(e) => onChange(e.target.value as DecisionDisposition)}
          className={`rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm font-medium ${DISPOSITION_OPTION_TONE[decision.disposition]}`}
        >
          {DECISION_DISPOSITIONS.map((d) => (
            <option key={d} value={d} className="text-gray-200">
              {DISPOSITION_LABEL[d]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={reason}
          placeholder="Reason (optional)"
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => {
            if (reason !== (decision.reason ?? "")) {
              onChange(decision.disposition, reason);
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-gray-800 bg-gray-950 px-3 py-1.5 text-sm text-gray-200 placeholder:text-gray-600 focus:border-[#7fb0ff] focus:outline-none"
        />
        {updatedLabel && (
          <span className="text-[11px] text-gray-500">
            updated {updatedLabel}
          </span>
        )}
      </div>
    </li>
  );
}

function DecisionsView() {
  const { productId } = Route.useParams();
  const { loading, user } = useAuth();
  const { state, ready, actions } = useStore();

  const product = state.products.find((p) => p.id === productId);

  // Recommendation seed, loaded once from the account-scoped server function.
  const [seedByProduct, setSeedByProduct] = useState<
    Record<string, DecisionSeedRecommendation[]> | null
  >(null);
  useEffect(() => {
    let cancelled = false;
    void getDecisionSeeds().then((list) => {
      if (cancelled) return;
      const map: Record<string, DecisionSeedRecommendation[]> = {};
      for (const s of list) map[s.productName] = s.recommendations;
      setSeedByProduct(map);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed this product's decisions once (default = not-decisioned) so the owner
  // sees their real modeled recommendations. Never re-seeds once decided, and
  // never overwrites owner-entered dispositions.
  const seededFor = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!ready || !product || !seedByProduct) return;
    if (seededFor.current.has(productId)) return;
    if ((state.decisions ?? {})[productId] !== undefined) {
      seededFor.current.add(productId);
      return;
    }
    const recs = seedByProduct[product.name] ?? [];
    actions.setDecisions(
      productId,
      recs.map((r) => ({ id: r.id, title: r.title, disposition: "not-decisioned" })),
    );
    seededFor.current.add(productId);
  }, [ready, product, seedByProduct, productId, state.decisions, actions]);

  const list = useMemo(
    () => (state.decisions ?? {})[productId] ?? [],
    [state.decisions, productId],
  );
  const counts = useMemo(() => summary(list), [list]);

  if (loading) {
    return <p className="py-20 text-center text-gray-500">Loading…</p>;
  }

  // Account-scoped gate: never render the owner's decisions to an anonymous visitor.
  if (!user) {
    return (
      <div className="silhat-panel border-dashed px-6 py-16 text-center">
        <p className="text-lg font-semibold text-gray-100">
          Sign in to see decisions
        </p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
          Your per-product decision history is private to your account.
        </p>
        <Link
          to="/login"
          className="silhat-btn silhat-btn-primary mt-5 inline-flex items-center rounded-xl px-5 py-2.5"
        >
          Log in / Sign up
        </Link>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="silhat-panel border-dashed px-6 py-16 text-center">
        <p className="text-lg font-semibold text-gray-100">Product not found</p>
        <p className="mt-1 text-sm text-gray-400">
          This product is no longer in your portfolio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="silhat-eyebrow">Agent Direct · Decisions</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
            {product.name}
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            What happened to each recommendation the Direct model surfaced for
            this product. <span className="italic">You decide</span> — nothing is
            auto-claimed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">
            {counts.deployed} deployed
          </span>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 font-semibold text-amber-300">
            {counts["paused-for-timing"]} paused
          </span>
          <span className="rounded-full bg-gray-800 px-2.5 py-1 font-semibold text-gray-300">
            {counts.deferred} deferred
          </span>
          <span className="rounded-full bg-gray-800 px-2.5 py-1 font-semibold text-gray-400">
            {counts["not-decisioned"]} not decisioned
          </span>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="silhat-panel border-dashed px-6 py-16 text-center">
          <p className="text-lg font-semibold text-gray-200">
            No modeled recommendations yet
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Once the Direct model surfaces prioritized work for this product, it
            appears here for you to decision.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((d) => (
            <DecisionRow
              key={d.id}
              decision={d}
              onChange={(disposition, reason) =>
                actions.setDecisionDisposition(
                  productId,
                  d.id,
                  disposition,
                  reason,
                )
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
