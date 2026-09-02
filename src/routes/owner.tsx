import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider } from "~/lib/useStore";
import AppShell from "~/components/AppShell";
import { isOwnerUser } from "~/lib/owner-access";

export const Route = createFileRoute("/owner")({
  component: () => <AuthProvider><StoreProvider><AppShell active="owner"><OwnerDashboard /></AppShell></StoreProvider></AuthProvider>,
});

type Overview = {
  users: number; activeFoundingBeta: number; openInvites: number; feedbackCount: number;
  waitlistCount: number; activePortfolioProducts: number; invitesEnabled: boolean;
  members: Array<Record<string, unknown>>; recentFeedback: Array<Record<string, unknown>>; invites: Array<Record<string, unknown>>;
};

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <div className="silhat-panel p-4"><p className="silhat-eyebrow">{label}</p><p className="mt-2 text-2xl font-bold text-gray-50">{value}</p>{note && <p className="mt-1 text-xs text-gray-500">{note}</p>}</div>;
}

function OwnerDashboard() {
  const { user, loading } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [email, setEmail] = useState("");
  const [accessDays, setAccessDays] = useState(45);
  const [inviteDays, setInviteDays] = useState(7);
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  const refresh = async () => {
    const response = await fetch("/api/owner/overview", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { overview?: Overview };
    setOverview(data.overview ?? null);
  };
  useEffect(() => { if (user && isOwnerUser(user)) void refresh(); }, [user?.id]);

  if (loading) return <p className="py-20 text-center text-gray-500">Loading…</p>;
  if (!user) return <section className="silhat-panel mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-bold">Log in to continue</h1><Link to="/login" className="silhat-btn silhat-btn-primary mt-5 inline-flex">Log in</Link></section>;
  if (!isOwnerUser(user)) return <section className="silhat-panel mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-bold">Owner dashboard unavailable</h1><Link to="/dashboard" className="silhat-btn silhat-btn-ghost mt-5 inline-flex">Return to Today</Link></section>;

  const invite = async () => {
    setMessage(""); setInviteUrl("");
    const response = await fetch("/api/owner/invite", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, accessDays, inviteDays }),
    });
    const data = (await response.json().catch(() => ({}))) as { invite?: { token: string; email: string }; error?: string };
    if (!response.ok || !data.invite) { setMessage(data.error === "beta_invites_disabled" ? "Invitations are staged but disabled. Set AILHAT_BETA_INVITES_ENABLED=true when you are ready to admit the cohort." : data.error ?? "Invite could not be created."); return; }
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const url = `${origin}/beta?invite=${encodeURIComponent(data.invite.token)}&email=${encodeURIComponent(data.invite.email)}`;
    setInviteUrl(url); setEmail(""); setMessage("Invite created. The token is shown once here; send it only to the invited builder.");
    await refresh();
  };

  const revoke = async (userId: number) => {
    await fetch("/api/owner/revoke", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) });
    await refresh();
  };

  return <div className="space-y-6">
    <section><p className="silhat-eyebrow">Owner · Founding Beta</p><h1 className="mt-1 text-3xl font-bold text-gray-50">Cohort control</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">Invite a deliberately small cohort, watch whether they add products and return, collect feedback, and revoke access without touching their account identity or deleting their portfolio.</p></section>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      <Stat label="Accounts" value={overview?.users ?? "—"} />
      <Stat label="Active beta" value={overview?.activeFoundingBeta ?? "—"} />
      <Stat label="Open invites" value={overview?.openInvites ?? "—"} />
      <Stat label="Feedback" value={overview?.feedbackCount ?? "—"} />
      <Stat label="Waitlist" value={overview?.waitlistCount ?? "—"} />
      <Stat label="Products" value={overview?.activePortfolioProducts ?? "—"} note="Across persisted accounts" />
    </section>

    <section className="silhat-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="silhat-eyebrow">Invite rail</p><h2 className="mt-1 text-xl font-semibold text-gray-100">Create a time-bounded Founding Beta invite</h2></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${overview?.invitesEnabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-400/25 bg-amber-400/[0.05] text-amber-300"}`}>{overview?.invitesEnabled ? "Enabled" : "Staged · disabled"}</span></div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1.5fr_0.6fr_0.6fr_auto] md:items-end"><label className="text-sm text-gray-400">Invited email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="silhat-input mt-1" /></label><label className="text-sm text-gray-400">Access days<input type="number" min={1} max={180} value={accessDays} onChange={(e) => setAccessDays(Number(e.target.value))} className="silhat-input mt-1" /></label><label className="text-sm text-gray-400">Invite expires<input type="number" min={1} max={30} value={inviteDays} onChange={(e) => setInviteDays(Number(e.target.value))} className="silhat-input mt-1" /></label><button type="button" onClick={() => void invite()} disabled={!email.trim()} className="silhat-btn silhat-btn-primary disabled:opacity-50">Create invite</button></div>
      {message && <p className="mt-3 text-sm text-gray-400">{message}</p>}
      {inviteUrl && <div className="mt-3 rounded-lg border border-[#7fb0ff]/20 bg-[#7fb0ff]/[0.04] p-3"><p className="text-[10px] uppercase tracking-wider text-gray-600">One-time invite URL</p><code className="mt-1 block break-all text-xs text-[#9cc8ff]">{inviteUrl}</code><button type="button" className="mt-2 text-xs font-semibold text-[#7fb0ff] hover:underline" onClick={() => void navigator.clipboard.writeText(inviteUrl)}>Copy invite</button></div>}
    </section>

    <section className="grid gap-5 xl:grid-cols-2">
      <div className="silhat-panel p-5"><p className="silhat-eyebrow">Members</p><h2 className="mt-1 text-xl font-semibold text-gray-100">Founding Beta accounts</h2><div className="mt-4 space-y-2">{(overview?.members ?? []).length === 0 ? <p className="text-sm text-gray-500">No beta members yet.</p> : overview!.members.map((raw) => { const row = raw as any; const active = !row.revoked_at && new Date(String(row.expires_at)).getTime() > Date.now(); return <div key={String(row.user_id)} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-semibold text-gray-200">{String(row.email)}</p><p className="mt-1 text-xs text-gray-600">{Number(row.active_products ?? 0)} products · {Number(row.feedback_count ?? 0)} feedback · expires {new Date(String(row.expires_at)).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><span className={`text-xs font-semibold ${active ? "text-emerald-300" : "text-gray-600"}`}>{active ? "Active" : "Inactive"}</span>{active && <button type="button" onClick={() => void revoke(Number(row.user_id))} className="text-xs font-semibold text-rose-300 hover:underline">Revoke</button>}</div></div></div>; })}</div></div>
      <div className="silhat-panel p-5"><p className="silhat-eyebrow">Recent feedback</p><h2 className="mt-1 text-xl font-semibold text-gray-100">What the cohort is telling you</h2><div className="mt-4 space-y-2">{(overview?.recentFeedback ?? []).length === 0 ? <p className="text-sm text-gray-500">No feedback yet.</p> : overview!.recentFeedback.slice(0,12).map((raw) => { const row = raw as any; return <div key={String(row.id)} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3"><div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider text-gray-600"><span>{String(row.category)}</span><span>·</span><span>{String(row.email)}</span>{row.route && <><span>·</span><span>{String(row.route)}</span></>}</div><p className="mt-2 text-sm leading-5 text-gray-300">{String(row.message)}</p></div>; })}</div></div>
    </section>

    <section className="rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-sm leading-6 text-amber-100/90"><strong>Release rail:</strong> the code can support invited accounts after tenant isolation, but invite issuance remains an explicit deployment switch. Beta is free early access; it does not silently create a paid entitlement or autonomous execution permission.</section>
  </div>;
}
