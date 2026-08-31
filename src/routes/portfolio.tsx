import { createFileRoute, Link } from "@tanstack/react-router";
import AppShell from "~/components/AppShell";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider, useStore } from "~/lib/useStore";
import { platformLabel } from "~/lib/store";
import { timeAgo } from "~/lib/observation";

export const Route = createFileRoute("/portfolio")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="portfolio">
          <PortfolioArchive />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

function PortfolioArchive() {
  const { user, loading } = useAuth();
  const { state, ready, actions } = useStore();
  const retired = [...(state.retiredProducts ?? [])].sort((a, b) => b.retiredAt - a.retiredAt);

  if (loading || !ready) {
    return <p className="py-20 text-center text-gray-500">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="silhat-panel px-6 py-16 text-center">
        <p className="text-lg font-semibold text-gray-100">Archive is private</p>
        <p className="mt-2 text-sm text-gray-400">Sign in to review preserved products.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="silhat-eyebrow">Archive · preserved context</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">Retired products</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            Active portfolio composition happens on Today. This surface exists only to preserve
            retired product context and reactivate it when needed.
          </p>
        </div>
        <Link to="/dashboard" className="silhat-btn silhat-btn-primary px-4 py-2">
          Back to Today
        </Link>
      </section>

      {retired.length === 0 ? (
        <section className="silhat-panel border-dashed px-6 py-14 text-center">
          <p className="text-lg font-semibold text-gray-200">Nothing archived</p>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-500">
            Retire a product from its Today tile when you want ailhat to stop prioritizing it
            while keeping its scans, work, decisions, opportunities, and history intact.
          </p>
          <Link to="/dashboard" className="mt-5 inline-block text-sm font-semibold text-[#7fb0ff] hover:underline">
            Manage active products on Today →
          </Link>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {retired.map((archive) => {
            const { product } = archive;
            const openAtRetirement = archive.items.filter((i) => i.status !== "done").length;
            return (
              <article key={product.id} className="silhat-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-gray-100">{product.name}</h2>
                      <span className="rounded-full border border-gray-700 bg-gray-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                        Retired
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {platformLabel(product.platform)} · retired {timeAgo(archive.retiredAt)}
                    </p>
                    {archive.reason && (
                      <p className="mt-3 text-sm leading-6 text-gray-400">{archive.reason}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => actions.reactivateProduct(product.id)}
                    className="shrink-0 rounded-lg border border-[#7fb0ff]/40 bg-[#7fb0ff]/10 px-3 py-2 text-xs font-semibold text-[#7fb0ff] hover:bg-[#7fb0ff]/15"
                  >
                    Reactivate
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 border-t border-gray-800 pt-4 text-xs text-gray-500 sm:grid-cols-4">
                  <span>{archive.items.length} work items</span>
                  <span>{openAtRetirement} open</span>
                  <span>{archive.decisions.length} decisions</span>
                  <span>{archive.scanHistory?.snapshots?.length ?? 0} scan snapshots</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
