import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/beta")({
  component: FoundingBetaSignup,
});

function FoundingBetaSignup() {
  const params = useMemo(
    () => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)),
    [],
  );
  const inviteToken = params.get("invite") ?? "";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!inviteToken) {
      setError("This Founding Beta link is missing its invite token.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/beta/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, inviteToken }),
      });
      const data = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setError(data.error ?? "We couldn't activate this Founding Beta invite.");
        return;
      }
      window.location.assign("/dashboard");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gray-950 px-6 py-12 text-gray-100">
      <div aria-hidden className="pointer-events-none absolute -top-44 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(127,176,255,0.15),transparent_70%)] blur-2xl" />
      <div className="relative mx-auto max-w-xl">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <div className="silhat-brand">A</div>
          <span className="font-display font-bold tracking-tight">ailhat</span>
        </Link>

        <div className="silhat-panel mt-10 p-8 sm:p-10">
          <div className="inline-flex rounded-full border border-[#7fb0ff]/30 bg-[#7fb0ff]/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7fb0ff]">
            Founding Beta
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold tracking-tight">Build ailhat with us.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Founding Beta members receive early access to customer-facing ailhat surfaces as they are verified account-safe, in exchange for candid product feedback. This is early access, not a paid subscription and not an owner/admin account.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Access", "Tenant-safe beta surfaces"],
              ["Window", "Time-bounded beta"],
              ["Exchange", "Usage + feedback"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
                <p className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
                <p className="mt-1 text-xs font-semibold text-gray-200">{value}</p>
              </div>
            ))}
          </div>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block text-sm font-medium text-gray-300">
              Invited email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm outline-none focus:border-[#7fb0ff]"
              />
            </label>
            <label className="block text-sm font-medium text-gray-300">
              Create password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="mt-1 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm outline-none focus:border-[#7fb0ff]"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !inviteToken}
              className="silhat-btn silhat-btn-primary w-full rounded-xl px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Activating…" : "Activate Founding Beta access"}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-gray-500">
            Already activated? <Link to="/login" className="font-semibold text-[#7fb0ff] hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
