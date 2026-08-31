// ailhat app shell — Portfolio Intelligence navigation for the authenticated
// product experience. Desktop-first. Must be rendered inside AuthProvider +
// StoreProvider (routes provide these).
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "~/lib/useStore";
import AuthNav from "~/components/AuthNav";
import AilhatBrandMark from "~/components/AilhatBrandMark";
import TodayWorkspaceControls from "~/components/TodayWorkspaceControls";
import { platformLabel } from "~/lib/store";
import { retirementRecommendationCount } from "~/lib/portfolio-lifecycle";

export type ShellView =
  | "today"
  | "intelligence"
  | "portfolio"
  | "control"
  | "learn"
  | "decisions";

const NAV: { id: ShellView; label: string; to: string; icon: ReactNode; hint: string }[] = [
  {
    id: "today",
    label: "Today",
    to: "/dashboard",
    hint: "Signals · active portfolio · composition",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="shrink-0">
        <path d="M3 12h4l2-6 4 12 2-6h6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "intelligence",
    label: "Intelligence",
    to: "/brief",
    hint: "Opportunities · risks · trends",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="shrink-0">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    id: "control",
    label: "Direct",
    to: "/control",
    hint: "Agent Direct · what to do next",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="shrink-0">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: "learn",
    label: "Learn",
    to: "/learn",
    hint: "Playbook · lessons · worked examples · skills",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="shrink-0">
        <path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4V5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6V5z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const BOTTOM_NAV: { label: string; disabled: boolean }[] = [
  { label: "Connections", disabled: true },
  { label: "Settings", disabled: true },
];

export default function AppShell({
  active,
  children,
}: {
  active: ShellView;
  children: ReactNode;
}) {
  const { state } = useStore();

  const activeIds = new Set(state.products.map((p) => p.id));
  const openCount = state.items.filter(
    (i) => activeIds.has(i.productId) && i.status !== "done",
  ).length;
  const retirementCount = retirementRecommendationCount(state);
  const retiredCount = state.retiredProducts?.length ?? 0;

  const viewLabel =
    active === "portfolio"
      ? "Product"
      : NAV.find((n) => n.id === active)?.label ?? "ailhat";

  return (
    <div className="flex min-h-dvh bg-gray-950 text-gray-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 flex-col border-r border-gray-800 bg-gray-950/95 sm:flex">
        <Link to="/dashboard" className="flex items-center gap-2.5 pb-4 pl-[18px] pr-4 pt-5">
          <AilhatBrandMark size={42} className="-ml-1" />
          <div className="leading-none">
            <div className="font-display text-[15px] font-bold tracking-tight text-gray-50">ailhat</div>
            <div className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#7fb0ff]">
              Portfolio Intelligence
            </div>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="silhat-eyebrow px-2.5 pb-1.5">Workspace</div>
          <div className="space-y-0.5">
            {NAV.map((n) => (
              <Link
                key={n.id}
                to={n.to as "/dashboard" | "/brief" | "/control" | "/learn"}
                className={`silhat-nav ${active === n.id ? "silhat-nav-active" : ""}`}
                title={n.hint}
              >
                {n.icon}
                <span className="truncate">{n.label}</span>
                {active === n.id && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#7fb0ff]" />
                )}
              </Link>
            ))}
          </div>

          {state.products.length > 0 && (
            <>
              <div className="silhat-eyebrow px-2.5 pb-1.5 pt-5">Portfolio</div>
              <div className="space-y-0.5">
                {state.products.slice(0, 8).map((p) => {
                  const open = state.items.filter(
                    (i) => i.productId === p.id && i.status !== "done",
                  ).length;
                  return (
                    <Link
                      key={p.id}
                      to="/product/$productId"
                      params={{ productId: p.id }}
                      className="silhat-nav"
                      title={`${platformLabel(p.platform)} · open Product Cockpit`}
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-gray-700 bg-gray-800 text-[10px] font-bold text-gray-300">
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="truncate">{p.name}</span>
                      {open > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400">
                          {open}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {retiredCount > 0 && (
            <>
              <div className="silhat-eyebrow px-2.5 pb-1.5 pt-5">Preserved</div>
              <Link
                to="/portfolio"
                className="silhat-nav"
                title="Retired products · context preserved"
              >
                <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />
                </span>
                <span className="truncate">Archive</span>
                <span className="ml-auto shrink-0 rounded-full bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                  {retiredCount}
                </span>
              </Link>
            </>
          )}

          <div className="silhat-eyebrow px-2.5 pb-1.5 pt-5">System</div>
          <div className="space-y-0.5">
            {BOTTOM_NAV.map((b) => (
              <div
                key={b.label}
                className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-gray-600"
                title={b.disabled ? "Coming soon" : undefined}
              >
                <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center">
                  <span className="h-1.5 w-1.5 rounded-full bg-gray-700" />
                </span>
                <span className="truncate">{b.label}</span>
                {b.disabled && (
                  <span className="ml-auto shrink-0 rounded border border-gray-800 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-gray-600">
                    Soon
                  </span>
                )}
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-gray-800 px-3 py-3">
          <div className="mb-3 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="leading-tight">
                <div className="text-sm font-semibold text-gray-100">
                  {state.products.length} active product{state.products.length === 1 ? "" : "s"}
                </div>
                <div className="text-[11px] text-gray-400">{openCount} open signal{openCount === 1 ? "" : "s"}</div>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Private
              </span>
            </div>
            {(retiredCount > 0 || retirementCount > 0) && (
              <div className="mt-2 border-t border-gray-800 pt-2 text-[11px] text-gray-500">
                {retirementCount > 0 ? `${retirementCount} lifecycle review${retirementCount === 1 ? "" : "s"} · ` : ""}
                {retiredCount > 0 ? `${retiredCount} preserved` : "manage from Today"}
              </div>
            )}
          </div>
          <AuthNav compact />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col sm:pl-60">
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3 sm:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <AilhatBrandMark size={30} />
            <span className="font-bold tracking-tight">ailhat</span>
          </Link>
          <div className="flex items-center gap-2">
            {retiredCount > 0 && (
              <Link
                to="/portfolio"
                className="rounded-lg border border-gray-800 px-2.5 py-1.5 text-xs font-semibold text-gray-400"
              >
                Archive · {retiredCount}
              </Link>
            )}
            <AuthNav compact />
          </div>
        </div>

        <header className="hidden items-center justify-between gap-4 border-b border-gray-800 bg-gray-950/80 px-8 py-3 backdrop-blur sm:flex">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="text-gray-400">{viewLabel}</span>
            <span className="text-gray-600">/</span>
            <span className="truncate text-gray-500">
              {active === "today"
                ? `Active portfolio · reorder · condense · retire`
                : active === "portfolio"
                  ? `Product cockpit / preserved archive`
                  : active === "control"
                    ? `Agent Direct · prepare governed work`
                    : active === "learn"
                      ? `Playbook · lessons & worked examples`
                      : active === "decisions"
                        ? `Agent Direct · per-product decisions`
                        : `Attention · prioritised signals`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <AuthNav />
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">{children}</div>
        </main>
      </div>
      {active === "today" && <TodayWorkspaceControls />}
    </div>
  );
}
