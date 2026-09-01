import { createFileRoute, Link } from "@tanstack/react-router";
import { StoreProvider, useStore } from "~/lib/useStore";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import AppShell from "~/components/AppShell";
import OpportunitySection from "~/components/OpportunitySection";
import MarketGapSection from "~/components/MarketGapSection";

export const Route = createFileRoute("/brief")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="intelligence">
          <Intelligence />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

function Intelligence() {
  const { user, loading: authLoading } = useAuth();
  const { state, ready } = useStore();

  if (authLoading || !ready) {
    return <p className="py-20 text-center text-gray-500">Loading…</p>;
  }

  if (!user) {
    return (
      <section className="mx-auto max-w-2xl py-12 text-center">
        <p className="silhat-eyebrow">Intelligence · private workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-50">Deeper judgment for the portfolio.</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-gray-400">
          RADAR, Opportunity Routing, Launch Readiness, market gaps, and evidence-backed product judgment are account-scoped. Today owns the daily operating brief; Intelligence is where you investigate what the portfolio should do next.
        </p>
        <Link to="/login" className="silhat-btn silhat-btn-primary mt-6 inline-flex px-5 py-2.5">
          Log in / Sign up
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="silhat-panel p-5">
        <p className="silhat-eyebrow">Intelligence · deeper judgment</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-50">What should the portfolio understand, test, or change?</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">
          Today answers what needs attention now. Intelligence goes deeper: external opportunity signals, routing decisions, launch-readiness evidence, market gaps, and portfolio-level reasoning that can become product work.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          <span className="rounded-full border border-gray-800 px-2.5 py-1">RADAR</span>
          <span>→</span>
          <span className="rounded-full border border-gray-800 px-2.5 py-1">Opportunity routing</span>
          <span>→</span>
          <span className="rounded-full border border-gray-800 px-2.5 py-1">Launch readiness</span>
          <span>→</span>
          <span className="rounded-full border border-gray-800 px-2.5 py-1">Product work</span>
        </div>
      </section>

      {state.products.length === 0 ? (
        <section className="silhat-panel border-dashed px-6 py-14 text-center">
          <p className="text-lg font-semibold text-gray-200">Add products before evaluating portfolio intelligence.</p>
          <p className="mt-1 text-sm text-gray-500">Today is where the active portfolio is composed and maintained.</p>
          <Link to="/dashboard" className="silhat-btn silhat-btn-primary mt-4 inline-flex px-5 py-2">
            Go to Today
          </Link>
        </section>
      ) : (
        <>
          <OpportunitySection />
          <MarketGapSection />
        </>
      )}
    </div>
  );
}
