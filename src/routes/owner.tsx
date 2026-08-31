import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { OwnerOverview } from "~/lib/access";

export const Route = createFileRoute("/owner")({
  component: OwnerDashboard,
});

type InviteResult = {
  token: string;
  email: string;
  expiresAt: string;
  accessDays: number;
};

function OwnerDashboard() {
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [accessDays, setAccessDays] = useState(45);
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/owner/overview", { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login?next=/owner");
        return;
      }
      const data = await response.json().catch(() => ({})) as { overview?: OwnerOverview; error?: string };
      if (!response.ok || !data.overview) {
        setError(response.status === 403 ? "This account does not have ailhat owner access." : data.error ?? "Unable to load owner data.");
        return;
      }
      setOverview(data.overview);
      setError("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setInvite(null);
    setError("");
    try {
      const response = await fetch("/api/owner/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, accessDays }),
      });
      const data = await response.json().catch(() => ({})) as { invite?: InviteResult; error?: string };
      if (!response.ok || !data.invite) {
        setError(data.error ?? "Unable to create Founding Beta invite.");
        return;
      }
      setInvite(data.invite);
      setInviteEmail("");
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const revoke = async (userId: number) => {
    if (!confirm("Revoke this member's Founding Beta entitlement? Their account and portfolio data will remain.")) return;
    const response = await fetch("/api/owner/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) await load();
  };

  const inviteUrl = invite && typeof window !== "undefined"
    ? `${window.location.origin}/beta?invite=${encodeURIComponent(invite.token)}&email=${encodeURIComponent(invite.email)}`
    : "";

  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-950/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="silhat-brand">A</div>
            <div>
              <div className="font-display text-sm font-bold">ailhat</div>
              <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#7fb0ff]">Owner</div>
            </div>
          </Link>
          <Link to="/dashboard" className="rounded-lg border border-gray-800 px-3 py-2 text-xs font-semibold text-gray-400 hover:text-gray-200">
            Back to product
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="max-w-3xl">
          <p className="silhat-eyebrow">Owner dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Operate the beta without confusing it with the business model.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Owner access, Founding Beta entitlement, and future paid plans are separate rails. The first cohort can use the customer product fully while pricing remains intentionally uncommitted.
          </p>
        </div>

        {error && <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
        {loading && <p className="mt-10 text-sm text-gray-500">Loading owner data…</p>}

        {overview && (
          <div className="mt-8 space-y-8">
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {[
                ["Users", overview.users],
                ["Founding Beta", overview.activeFoundingBeta],
                ["Open invites", overview.openInvites],
                ["Feedback", overview.feedbackCount],
                ["Waitlist", overview.waitlistCount],
                ["Active products", overview.activePortfolioProducts],
              ].map(([label, value]) => (
                <div key={label} className="silhat-panel p-4">
                  <p className="font-display text-2xl font-bold text-gray-100">{value}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
              <div className="silhat-panel p-6">
                <p className="silhat-eyebrow">Founding Beta cohort</p>
                <h2 className="mt-2 text-xl font-semibold">Invite deliberately</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  Default access is 45 days. Invite links expire after 7 days. Beta access is not recorded as revenue and does not grant owner/admin visibility.
                </p>
                <form onSubmit={createInvite} className="mt-6 grid gap-3 sm:grid-cols-[1fr_110px_auto]">
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="builder@example.com"
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm outline-none focus:border-[#7fb0ff]"
                  />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={accessDays}
                    onChange={(event) => setAccessDays(Number(event.target.value))}
                    className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm outline-none focus:border-[#7fb0ff]"
                    aria-label="Access days"
                  />
                  <button type="submit" disabled={submitting} className="silhat-btn silhat-btn-primary rounded-lg px-4 py-2.5 disabled:opacity-50">
                    {submitting ? "Creating…" : "Create invite"}
                  </button>
                </form>

                {invite && (
                  <div className="mt-5 rounded-xl border border-[#7fb0ff]/25 bg-[#7fb0ff]/5 p-4">
                    <p className="text-sm font-semibold text-[#b8d2ff]">Invite ready for {invite.email}</p>
                    <p className="mt-1 text-xs text-gray-500">{invite.accessDays} days of beta access · invite expires {new Date(invite.expiresAt).toLocaleDateString()}</p>
                    <div className="mt-3 flex gap-2">
                      <input readOnly value={inviteUrl} className="min-w-0 flex-1 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-xs text-gray-400" />
                      <button type="button" onClick={() => void navigator.clipboard.writeText(inviteUrl)} className="rounded-lg border border-gray-700 px-3 py-2 text-xs font-semibold text-gray-300">Copy</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="silhat-panel p-6">
                <p className="silhat-eyebrow">Commercial rails</p>
                <h2 className="mt-2 text-xl font-semibold">Pricing: intentionally TBD</h2>
                <p className="mt-2 text-sm leading-6 text-gray-400">
                  The schema already separates the commercial plan from beta entitlement. Do not label Founding Beta users as Pro or paid. Use cohort behavior to determine what should eventually be metered.
                </p>
                <div className="mt-5 space-y-3 text-sm">
                  <Rail label="Owner role" value="Internal · unlimited · non-commercial" />
                  <Rail label="Founding Beta" value="Invite-only · time-bounded · feedback required" />
                  <Rail label="Free" value="Reserved customer plan key · limits not set" />
                  <Rail label="Paid" value="Plan key ready · price/features not set" />
                </div>
              </div>
            </section>

            <section className="silhat-panel overflow-hidden">
              <div className="border-b border-gray-800 px-5 py-4">
                <p className="silhat-eyebrow">Cohort activity</p>
                <h2 className="mt-1 text-lg font-semibold">Active Founding Beta members</h2>
              </div>
              {overview.members.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-500">No active Founding Beta members yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-900/70 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                      <tr><th className="px-5 py-3">Member</th><th className="px-5 py-3">Products</th><th className="px-5 py-3">Feedback</th><th className="px-5 py-3">Expires</th><th className="px-5 py-3"></th></tr>
                    </thead>
                    <tbody>
                      {overview.members.map((member) => (
                        <tr key={member.userId} className="border-t border-gray-800">
                          <td className="px-5 py-4"><div className="font-medium text-gray-200">{member.email}</div><div className="mt-1 text-xs text-gray-600">plan: {member.planKey}</div></td>
                          <td className="px-5 py-4 text-gray-400">{member.activeProducts}</td>
                          <td className="px-5 py-4 text-gray-400">{member.feedbackCount}</td>
                          <td className="px-5 py-4 text-gray-400">{new Date(member.betaExpiresAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4 text-right"><button type="button" onClick={() => void revoke(member.userId)} className="text-xs font-semibold text-rose-400 hover:text-rose-300">Revoke beta</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="silhat-panel overflow-hidden">
              <div className="border-b border-gray-800 px-5 py-4">
                <p className="silhat-eyebrow">Feedback</p>
                <h2 className="mt-1 text-lg font-semibold">Recent Founding Beta signal</h2>
              </div>
              {overview.recentFeedback.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-500">No beta feedback yet.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {overview.recentFeedback.map((item) => (
                    <article key={item.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-200">{item.email}</p>
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#7fb0ff]">{item.category}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-400">{item.message}</p>
                      <p className="mt-2 text-xs text-gray-600">{item.route ?? "Unknown route"} · {new Date(item.createdAt).toLocaleString()}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function Rail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
      <p className="font-semibold text-gray-200">{label}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{value}</p>
    </div>
  );
}
