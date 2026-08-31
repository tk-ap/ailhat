// Small auth-affording control for the nav. Renders the current user's email
// + Log out when authed; otherwise a "Log in" link. Must be rendered inside an
// AuthProvider. Owner-link visibility is only a convenience; /owner is enforced
// server-side against AILHAT_OWNER_EMAIL.
import { Link } from "@tanstack/react-router";
import { useAuth } from "~/lib/useAuth";

const DEFAULT_OWNER_EMAIL = "tahlia.ashwood@gmail.com";

export default function AuthNav({ compact = false }: { compact?: boolean }) {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <span className="text-sm text-gray-400">…</span>;
  }

  if (user) {
    const isOwner = user.email.trim().toLowerCase() === DEFAULT_OWNER_EMAIL;
    return (
      <div className="flex items-center gap-2">
        {!compact && (
          <span className="hidden max-w-[160px] truncate text-sm text-gray-500 sm:inline dark:text-gray-400">
            {user.email}
          </span>
        )}
        {isOwner && (
          <Link
            to="/owner"
            title="Owner dashboard"
            className="rounded-lg border border-[#7fb0ff]/25 bg-[#7fb0ff]/5 px-2.5 py-1.5 text-xs font-semibold text-[#9dc2ff] transition hover:border-[#7fb0ff]/50"
          >
            Owner
          </Link>
        )}
        <button
          onClick={() => void logout()}
          title="Log out"
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-sm font-medium text-gray-300 transition hover:bg-gray-800 hover:text-gray-100"
        >
          {compact && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {compact ? "" : "Log out"}
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/login"
      className="silhat-btn silhat-btn-ghost"
    >
      Log in
    </Link>
  );
}
