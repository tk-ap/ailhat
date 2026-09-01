import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider, useStore } from "~/lib/useStore";
import AppShell from "~/components/AppShell";
import { isOwnerUser } from "~/lib/owner-access";

export const Route = createFileRoute("/owner")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="owner">
          <OwnerDashboard />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="silhat-panel p-4">
      <p className="silhat-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-50">{value}</p>
      {note && <p className="mt-1 text-xs text-gray-500">{note}</p>}
    </div>
  );
}

function OwnerDashboard() {
  const { user, loading } = useAuth();
  const { state, ready } = useStore();

  if (loading || !ready) {
    return <p className="py-20 text-center text-gray-500">Loading…</p>;
  }

  if (!user) {
    return (
      <section className="silhat-panel mx-auto max-w-xl p-8 text-center">
        <p className="silhat-eyebrow">Owner access</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-50">Log in to continue</h1>
        <Link to="/login" className="silhat-btn silhat-btn-primary mt-5 inline-flex px-4 py-2">
          Log in
        </Link>
      </section>
    );
  }

  if (!isOwnerUser(user)) {
    return (
      <section className="silhat-panel mx-auto max-w-xl p-8 text-center">
        <p className="silhat-eyebrow">Owner access</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-50">Owner dashboard unavailable</h1>
        <p className="mt-2 text-sm text-gray-400">
          This surface is restricted to the current ailhat owner account.
        </p>
        <Link to="/dashboard" className="silhat-btn silhat-btn-ghost mt-5 inline-flex px-4 py-2">
          Return to Today
        </Link>
      </section>
    );
  }

  const activeIds = new Set(state.products.map((p) => p.id));
  const openItems = state.items.filter((item) => activeIds.has(item.productId) && item.status !== "done");
  const retired = state.retiredProducts?.length ?? 0;
  const scans = Object.values(state.scanHistory ?? {});
  const scanFailures = scans.filter((history) => history?.consecutiveFailures > 0).length;
  const scanCoverage = scans.filter((history) => !!history?.lastGood).length;

  return (
    <div className="space-y-6">
      <section>
        <p className="silhat-eyebrow">Owner · Operator view</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-50">Owner Dashboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Private operating controls for ailhat itself. This is intentionally separate from the portfolio workspace: product intelligence belongs in Today and Intelligence; platform administration belongs here.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active portfolio" value={state.products.length} note={`${retired} preserved in archive`} />
        <Stat label="Open work" value={openItems.length} note="Across active products" />
        <Stat label="Scan coverage" value={`${scanCoverage}/${state.products.length}`} note="Products with known-good scan evidence" />
        <Stat label="Scan attention" value={scanFailures} note="Products with recent scan failures" />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="silhat-panel p-5">
          <p className="silhat-eyebrow">Access mode</p>
          <h2 className="mt-2 text-xl font-bold text-gray-50">Owner-first private beta</h2>
          <div className="mt-4 space-y-3 text-sm text-gray-400">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <span>Owner account</span>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">Active</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <span>Public signup</span>
              <span className="text-gray-500">Closed after first account</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Invitations</span>
              <span className="text-amber-300">Not enabled · tenant safety required</span>
            </div>
          </div>
        </div>

        <div className="silhat-panel p-5">
          <p className="silhat-eyebrow">System surfaces</p>
          <h2 className="mt-2 text-xl font-bold text-gray-50">What becomes configurable here</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-gray-200">Connections</span>
                <span className="text-xs text-[#7fb0ff]">Next useful build</span>
              </div>
              <p className="mt-1 text-gray-500">Evidence sources, execution destinations, sync health, permissions and product scope.</p>
            </div>
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-gray-200">Settings</span>
                <span className="text-xs text-gray-500">Scoped</span>
              </div>
              <p className="mt-1 text-gray-500">Intelligence thresholds, scan cadence, evidence freshness, privacy and later tenant/account controls.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="silhat-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="silhat-eyebrow">Safety boundary</p>
            <h2 className="mt-2 text-xl font-bold text-gray-50">Administration does not become portfolio intelligence</h2>
            <p className="mt-2 max-w-3xl text-sm text-gray-400">
              Owner controls can configure ailhat, but they should not create fake product signals, bypass evidence requirements, or silently mutate Product Cockpit state. Operator actions remain distinct from the Scan → Review → Prepare → Execute → Re-scan loop.
            </p>
          </div>
          <Link to="/dashboard" className="silhat-btn silhat-btn-ghost px-4 py-2">
            Back to Today
          </Link>
        </div>
      </section>
    </div>
  );
}
