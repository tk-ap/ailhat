// Ailhat app shell — the premium dark command-center sidebar that wraps the
// authenticated app views (dashboard "Today", brief "Intelligence"). Desktop-first.
// Must be rendered inside AuthProvider + StoreProvider (routes provide these).
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useStore } from "~/lib/useStore";
import { useAuth } from "~/lib/useAuth";
import AuthNav from "~/components/AuthNav";
import { platformLabel } from "~/lib/store";

export type ShellView = "today" | "intelligence" | "allocation";

const NAV: { id: ShellView; label: string; to: string; icon: ReactNode; hint: string }[] = [
  {
    id: "today",
    label: "Today",
    to: "/dashboard",
    hint: "Signals · portfolio",
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
    id: "allocation",
    label: "Allocation",
    to: "/allocation",
    hint: "Capacity · where to spend next",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="shrink-0">
        <circle cx="12" cy="12" r="7.5" />
        <circle cx="12" cy="12" r="2.5" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
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
  const { user } = useAuth();
  const { pathname } = useLocation();

  const openCount = state.items.filter((i) => i.status !== "done").length;
  const navFor = (id: ShellView) => {
    if (id === "today") return pathname === "/dashboard" || pathname === "/";
    if (id === "intelligence") return pathname === "/brief";
    return pathname === "/allocation";
  };

  return (
    <div className="flex min-h-dvh bg-gray-950 text-gray-100">
      {/* ---------- Sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 shrink-0 flex-col border-r border-gray-800 bg-gray-950/95 sm:flex">
        {/* Brand */}
        <Link to="/dashboard" className="flex items-center gap-2.5 pl-[22px] pr-4 pb-4 pt-5">
          <div className="silhat-brand">A</div>
          <div className="leading-none">
            <div className="font-display text-[15px] font-bold tracking-tight text-gray-50">ailhat</div>
            <div className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7fb0ff]">
              Command center
            </div>
          </div>
        </Link>

        {/* Primary nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="silhat-eyebrow px-2.5 pb-1.5">Workspace</div>
          <div className="space-y-0.5">
            {NAV.map((n) => (
              <Link
                key={n.id}
                to={n.to as "/dashboard" | "/brief" | "/allocation"}
                className={`silhat-nav ${navFor(n.id) ? "silhat-nav-active" : ""}`}
                title={n.hint}
              >
                {n.icon}
                <span className="truncate">{n.label}</span>
                {navFor(n.id) && (
                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#7fb0ff]" />
                )}
              </Link>
            ))}
          </div>

          {/* Portfolio / Products */}
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
                      to="/dashboard"
                      className="silhat-nav"
                      title={platformLabel(p.platform)}
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

          {/* Connections / Settings */}
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

        {/* Sidebar footer — summary + user */}
        <div className="border-t border-gray-800 px-3 py-3">
          <div className="mb-3 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-3 py-2.5">
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-100">
                {state.products.length} product{state.products.length === 1 ? "" : "s"}
              </div>
              <div className="text-[11px] text-gray-400">{openCount} open signal{openCount === 1 ? "" : "s"}</div>
            </div>
            <div className="silhat-live">
              <span className="ping-dot ping-dot--blue h-1.5 w-1.5 rounded-full bg-[#7fb0ff]" />
              Live
            </div>
          </div>
          <AuthNav compact />
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex min-w-0 flex-1 flex-col sm:pl-60">
        {/* Mobile top bar (sidebar hidden on small screens) */}
        <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-3 sm:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="silhat-brand">A</div>
            <span className="font-bold tracking-tight">ailhat</span>
          </Link>
          <AuthNav compact />
        </div>

        {/* Desktop top bar with quick summary */}
        <header className="hidden items-center justify-between gap-4 border-b border-gray-800 bg-gray-950/80 px-8 py-3 backdrop-blur sm:flex">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="text-gray-400">{NAV.find((n) => n.id === active)?.label ?? "ailhat"}</span>
            <span className="text-gray-600">/</span>
            <span className="truncate text-gray-500">
              {active === "today"
                ? `Overview · ${state.products.length} products`
                : active === "allocation"
                  ? "Capacity · where to spend attention"
                  : `Attention · prioritised signals`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden max-w-[200px] truncate text-sm text-gray-400 lg:inline">
                {user.email}
              </span>
            )}
            <AuthNav />
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-7xl px-6 py-8 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
