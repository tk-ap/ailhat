import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import AilhatBrandMark from "~/components/AilhatBrandMark";

export const Route = createFileRoute("/beta")({ component: FoundingBetaSignup });

function FoundingBetaSignup() {
  const params = useMemo(() => typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search), []);
  const inviteToken = params.get("invite") ?? "";
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!inviteToken) { setError("This Founding Beta link is missing its invite token."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/beta/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, inviteToken }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) { setError(data.error ?? "We couldn't activate this invite."); return; }
      window.location.assign("/dashboard");
    } finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-dvh bg-gray-950 px-6 py-12 text-gray-100">
      <div className="mx-auto max-w-xl">
        <Link to="/" className="inline-flex items-center gap-2.5"><AilhatBrandMark size={38} /><span className="font-display font-bold">ailhat</span></Link>
        <section className="silhat-panel mt-10 p-8 sm:p-10">
          <span className="rounded-full border border-[#7fb0ff]/30 bg-[#7fb0ff]/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#9cc8ff]">Founding Beta</span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight">Build your portfolio intelligence with us.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-400">Founding Beta is time-bounded early access to tenant-isolated ailhat surfaces in exchange for candid product feedback. It is not a paid plan, owner/admin access, or permission for ailhat to execute work autonomously.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">{[["Isolation","Your account only"],["Access","Time bounded"],["Exchange","Usage + feedback"]].map(([label,value]) => <div key={label} className="rounded-lg border border-gray-800 bg-gray-900/60 p-3"><p className="text-[10px] uppercase tracking-wider text-gray-600">{label}</p><p className="mt-1 text-xs font-semibold text-gray-200">{value}</p></div>)}</div>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block text-sm text-gray-300">Invited email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="silhat-input mt-1" /></label>
            <label className="block text-sm text-gray-300">Create password<input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="silhat-input mt-1" placeholder="At least 8 characters" /></label>
            {error && <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
            <button type="submit" disabled={submitting || !inviteToken} className="silhat-btn silhat-btn-primary w-full py-3 disabled:opacity-50">{submitting ? "Activating…" : "Activate Founding Beta"}</button>
          </form>
          <p className="mt-5 text-center text-xs text-gray-500">Already activated? <Link to="/login" className="font-semibold text-[#7fb0ff] hover:underline">Log in</Link></p>
        </section>
      </div>
    </div>
  );
}
