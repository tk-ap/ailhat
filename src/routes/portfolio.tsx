import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import AppShell from "~/components/AppShell";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider, useStore } from "~/lib/useStore";
import { platformLabel } from "~/lib/store";
import {
  assessPortfolioRetirement,
  type RetirementAssessment,
} from "~/lib/portfolio-lifecycle";
import { timeAgo } from "~/lib/observation";

export const Route = createFileRoute("/portfolio")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="portfolio">
          <PortfolioPage />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

function AssessmentBadge({ assessment }: { assessment: RetirementAssessment }) {
  const cfg =
    assessment.action === "recommend_retire"
      ? {
          label: "Retirement candidate",
          cls: "border-amber-500/30 bg-amber-500/10 text-amber-300",
        }
      : assessment.action === "review"
        ? {
            label: "Review lifecycle",
            cls: "border-sky-500/30 bg-sky-500/10 text-sky-300",
          }
        : {
            label: "Active",
            cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
          };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function ActiveProductRow({ assessment }: { assessment: RetirementAssessment }) {
  const { state, actions } = useStore();
  const product = state.products.find((p) => p.id === assessment.productId);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  if (!product) return null;

  const open = state.items.filter(
    (i) => i.productId === product.id && i.status !== "done",
  ).length;
  const history = state.scanHistory?.[product.id];
  const engagement = state.engagement?.[product.id];

  const retire = () => {
    actions.retireProduct(
      product.id,
      reason.trim() ||
        (assessment.action === "recommend_retire"
          ? "Retired after portfolio lifecycle review."
          : "Retired by owner."),
    );
    setConfirming(false);
    setReason("");
  };

  return (
    <article className="silhat-panel overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-800 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="truncate text-lg font-semibold text-gray-100">{product.name}</h2>
            <AssessmentBadge assessment={assessment} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{platformLabel(product.platform)}</span>
            {open > 0 && <span>{open} open item{open === 1 ? "" : "s"}</span>}
            {history?.lastGood?.scannedAt && (
              <span>last observed {timeAgo(history.lastGood.scannedAt)}</span>
            )}
          </div>
          {product.url && (
            <a
              href={product.url.startsWith("http") ? product.url : `https://${product.url}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block max-w-xl truncate text-sm text-cyan-400 hover:underline"
            >
              {product.url}
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:border-amber-500/50 hover:text-amber-300"
        >
          Retire product
        </button>
        <Link
          to="/products/$productId"
          params={{ productId: product.id }}
          className="rounded-lg border border-cyan-800/70 bg-cyan-950/30 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/40"
        >
          All-up review
        </Link>
      </div>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="silhat-eyebrow">Lifecycle intelligence</p>
          <p className="mt-2 text-sm leading-6 text-gray-300">{assessment.reasoning}</p>
          <ul className="mt-3 space-y-1.5 text-xs leading-5 text-gray-500">
            {assessment.evidence.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-600" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
          <p className="silhat-eyebrow">Engagement evidence</p>
          {engagement ? (
            <div className="mt-2 space-y-1.5 text-sm text-gray-300">
              <p>
                <span className="font-semibold capitalize">{engagement.level}</span>
                {engagement.trend && engagement.trend !== "unknown"
                  ? ` · ${engagement.trend}`
                  : ""}
              </p>
              <p className="text-xs text-gray-500">
                {engagement.source} · {engagement.windowDays}-day window · {timeAgo(engagement.observedAt)}
              </p>
              {engagement.summary && (
                <p className="text-xs leading-5 text-gray-400">{engagement.summary}</p>
              )}
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-sm text-gray-300">No analytics evidence connected yet.</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                ailhat will not infer low engagement from silence. Until a traffic or
                engagement source supplies evidence, inactivity can trigger a review but
                not a retirement recommendation.
              </p>
            </div>
          )}
        </div>
      </div>

      {assessment.action === "recommend_retire" && !confirming && (
        <div className="border-t border-amber-500/20 bg-amber-500/5 px-5 py-3 text-sm text-amber-100">
          <strong>Consider retiring this product.</strong>{" "}
          The context will stay preserved, but ailhat will stop spending active
          portfolio-intelligence attention on it unless you reactivate it.
        </div>
      )}

      {confirming && (
        <div className="border-t border-gray-800 bg-gray-950/70 px-5 py-4">
          <div className="max-w-2xl">
            <p className="font-semibold text-gray-100">Retire {product.name}?</p>
            <p className="mt-1 text-sm leading-6 text-gray-400">
              This is reversible. ailhat will preserve the product, checklist, decisions,
              scan history, opportunities, activity, and engagement evidence, while
              removing the product from active planning and intelligence surfaces.
            </p>
            <label className="mt-3 block text-xs font-medium text-gray-400">
              Optional reason
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Paused indefinitely, superseded, no longer pursuing"
                className="mt-1.5 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 outline-none focus:border-cyan-600"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={retire}
                className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-amber-950 hover:bg-amber-400"
              >
                Retire and preserve context
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setReason("");
                }}
                className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function RetiredPortfolio() {
  const { state, actions } = useStore();
  const retired = [...(state.retiredProducts ?? [])].sort(
    (a, b) => b.retiredAt - a.retiredAt,
  );

  if (retired.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <p className="silhat-eyebrow">Retired portfolio</p>
        <h2 className="mt-1 text-xl font-semibold text-gray-100">Preserved, not prioritized</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-400">
          Retired products retain their operating history and can be reactivated at any time,
          but they no longer compete for active intelligence, capacity, or planning attention.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {retired.map((archive) => {
          const { product } = archive;
          const openAtRetirement = archive.items.filter((i) => i.status !== "done").length;
          return (
            <article key={product.id} className="silhat-panel p-4 opacity-85">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-gray-200">{product.name}</h3>
                    <span className="rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Retired
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {platformLabel(product.platform)} · retired {timeAgo(archive.retiredAt)}
                  </p>
                  {archive.reason && (
                    <p className="mt-2 text-sm leading-5 text-gray-400">{archive.reason}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => actions.reactivateProduct(product.id)}
                  className="shrink-0 rounded-lg border border-cyan-700/60 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-900/50"
                >
                  Reactivate
                </button>
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-800 pt-3 text-xs text-gray-500">
                <span>{archive.items.length} preserved items</span>
                <span>{openAtRetirement} open at retirement</span>
                <span>{archive.decisions.length} decisions</span>
                {archive.scanHistory?.snapshots?.length ? (
                  <span>{archive.scanHistory.snapshots.length} scan snapshots</span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function PortfolioPage() {
  const { user, loading } = useAuth();
  const { state, ready } = useStore();

  const assessments = useMemo(
    () => assessPortfolioRetirement(state),
    [state],
  );
  const recommended = assessments.filter((a) => a.action === "recommend_retire").length;
  const reviews = assessments.filter((a) => a.action === "review").length;

  if (loading || !ready) {
    return <p className="py-20 text-center text-gray-500">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="silhat-panel px-6 py-16 text-center">
        <p className="text-lg font-semibold text-gray-100">Portfolio lifecycle is private</p>
        <p className="mt-2 text-sm text-gray-400">Sign in to manage active and retired products.</p>
      </div>
    );
  }

  return (
    <div className="space-y-9">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="silhat-eyebrow">Portfolio · Lifecycle</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">Protect your active attention</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Keep inactive work in institutional memory without letting it consume the same
            planning space as products you are actively building, operating, or growing.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full border border-gray-800 bg-gray-900 px-3 py-1.5 text-gray-300">
            {state.products.length} active
          </span>
          <span className="rounded-full border border-gray-800 bg-gray-900 px-3 py-1.5 text-gray-500">
            {state.retiredProducts?.length ?? 0} retired
          </span>
        </div>
      </section>

      {(recommended > 0 || reviews > 0) && (
        <section className="rounded-xl border border-sky-500/20 bg-sky-500/5 px-5 py-4">
          <p className="text-sm font-semibold text-sky-200">Lifecycle review</p>
          <p className="mt-1 text-sm leading-6 text-gray-400">
            {recommended > 0
              ? `${recommended} product${recommended === 1 ? " has" : "s have"} enough corroborated inactivity evidence for ailhat to suggest retirement. `
              : ""}
            {reviews > 0
              ? `${reviews} product${reviews === 1 ? " needs" : "s need"} a lifecycle review or fresher evidence.`
              : ""}
          </p>
        </section>
      )}

      <section className="space-y-4">
        <div>
          <p className="silhat-eyebrow">Active portfolio</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-100">Prime intelligence set</h2>
          <p className="mt-1 text-sm text-gray-500">
            These products participate in scanning, prioritization, opportunity detection,
            Direct, and portfolio planning.
          </p>
        </div>

        {assessments.length === 0 ? (
          <div className="silhat-panel border-dashed px-6 py-12 text-center text-sm text-gray-500">
            No active products yet.
          </div>
        ) : (
          <div className="space-y-4">
            {assessments
              .sort((a, b) => {
                const order = { recommend_retire: 0, review: 1, none: 2 } as const;
                return order[a.action] - order[b.action];
              })
              .map((assessment) => (
                <ActiveProductRow key={assessment.productId} assessment={assessment} />
              ))}
          </div>
        )}
      </section>

      <RetiredPortfolio />
    </div>
  );
}
