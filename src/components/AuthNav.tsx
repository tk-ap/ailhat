import { Link } from "@tanstack/react-router";
import { useAuth } from "~/lib/useAuth";
import { isOwnerUser } from "~/lib/owner-access";

function ProfileIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" strokeLinecap="round" /></svg>;
}

export default function AuthNav({ compact = false }: { compact?: boolean }) {
  const { user, loading, logout, access } = useAuth();
  if (loading) return <span className="text-sm text-gray-400">…</span>;

  if (user) {
    const owner = isOwnerUser(user);
    const accessLabel = owner
      ? "Owner account"
      : access?.foundingBeta
        ? `Founding Beta${access.betaExpiresAt ? ` · through ${new Date(access.betaExpiresAt).toLocaleDateString()}` : ""}`
        : "Access inactive";
    return (
      <details className="group relative">
        <summary className={`flex cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-700 text-sm font-medium text-gray-300 transition hover:bg-gray-800 hover:text-gray-100 [&::-webkit-details-marker]:hidden ${compact ? "px-2.5 py-2" : "px-2.5 py-1.5"}`} title="Profile">
          <ProfileIcon />
          {!compact && <span className="hidden max-w-[160px] truncate sm:inline">{user.email}</span>}
          {compact && <span className="text-xs">Profile</span>}
          <span className="text-[10px] text-gray-600 transition group-open:rotate-180">⌄</span>
        </summary>
        <div className={`absolute z-50 mt-2 w-72 overflow-hidden rounded-xl border border-gray-800 bg-gray-950 shadow-2xl ${compact ? "bottom-full left-0 mb-2 mt-0" : "right-0"}`}>
          <div className="border-b border-gray-800 px-3 py-3">
            <p className="truncate text-sm font-semibold text-gray-100">{user.email}</p>
            <p className={`mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${access?.productAccess || owner ? "text-gray-500" : "text-amber-300"}`}>{accessLabel}</p>
          </div>
          <div className="p-1.5">
            {owner && <Link to="/owner" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-900 hover:text-gray-100"><span>Owner Dashboard</span><span className="text-[10px] uppercase tracking-wider text-[#7fb0ff]">Private</span></Link>}
            {(access?.foundingBeta || owner) && <Link to="/feedback" className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-900 hover:text-gray-100"><span>Send feedback</span><span className="text-[10px] uppercase tracking-wider text-gray-600">Beta</span></Link>}
            <button type="button" onClick={() => void logout()} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-400 hover:bg-gray-900 hover:text-gray-100">Log out</button>
          </div>
        </div>
      </details>
    );
  }

  return <Link to="/login" className="silhat-btn silhat-btn-ghost">Log in</Link>;
}
