import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "~/lib/useAuth";

export const Route = createFileRoute("/import/alvira")({
  component: () => (
    <AuthProvider>
      <AlviraImport />
    </AuthProvider>
  ),
});

type Imported = { topic: string; offering: string; updatedAt: string | null };

function AlviraImport() {
  const { user, loading } = useAuth();
  const token = useMemo(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token")?.trim() || "", []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [imported, setImported] = useState<Imported | null>(null);

  useEffect(() => {
    if (!token) setError("This ALVIRA handoff link is missing its one-time token.");
  }, [token]);

  if (loading) return <Shell><p className="text-sm text-gray-400">Checking your ailhat account…</p></Shell>;

  if (!user) {
    const next = `/import/alvira?token=${encodeURIComponent(token)}`;
    return (
      <Shell>
        <div className="mx-auto max-w-xl silhat-panel p-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#7fb0ff]">ALVIRA → ailhat</p>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">ALVIRA prepared Context for your portfolio.</h1>
          <p className="mt-4 leading-7 text-gray-400">Sign in first. ailhat will not consume the one-time handoff until you explicitly import it after authentication.</p>
          <a href={`/login?next=${encodeURIComponent(next)}`} className="silhat-btn silhat-btn-primary mt-7 inline-flex rounded-xl px-5 py-3">Log in to continue →</a>
        </div>
      </Shell>
    );
  }

  const accept = async () => {
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/import/alvira", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json() as { ok?: boolean; error?: string; imported?: Imported };
      if (!response.ok || !data.ok || !data.imported) throw new Error(data.error || "Unable to import this ALVIRA Context.");
      setImported(data.imported);
      window.history.replaceState({}, "", "/import/alvira");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to import this ALVIRA Context.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-2xl silhat-panel p-8 sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#7fb0ff]">ALVIRA → ailhat</p>
        {!imported ? (
          <>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">You already gave ALVIRA the background.</h1>
            <p className="mt-5 text-lg leading-8 text-gray-300">This handoff carries only the ALVIRA Context you selected. ailhat receives it as starter portfolio background so you do not have to explain the same ground again.</p>
            <div className="mt-6 border border-white/10 bg-white/[0.03] p-5 text-sm leading-6 text-gray-400">
              <p><strong className="text-gray-100">What happens now:</strong> the selected Context is stored with your ailhat account as imported background.</p>
              <p className="mt-2"><strong className="text-gray-100">What does not happen:</strong> ailhat does not silently create products, priorities, or conclusions from it. Product mapping remains reviewable.</p>
            </div>
            <button type="button" disabled={busy || !token} onClick={() => void accept()} className="silhat-btn silhat-btn-primary mt-7 w-full rounded-xl px-5 py-3 disabled:opacity-50">
              {busy ? "Importing selected Context…" : "Accept ALVIRA Context →"}
            </button>
            {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
          </>
        ) : (
          <>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">ALVIRA gave me the background.</h1>
            <p className="mt-5 text-lg leading-8 text-gray-300">Imported <strong className="text-gray-100">{imported.topic}</strong>. ailhat can now treat that Context as the starting point for the portfolio conversation instead of asking you to rebuild it from scratch.</p>
            <div className="mt-6 border-l-2 border-[#7fb0ff] pl-5 text-sm leading-6 text-gray-400">
              <p>ALVIRA remains the source of truth for maintained personal/project Context.</p>
              <p className="mt-2">ailhat remains responsible for portfolio attention, opportunity, risk, drift, and prioritization.</p>
            </div>
            <Link to="/dashboard" className="silhat-btn silhat-btn-primary mt-7 inline-flex rounded-xl px-5 py-3">Continue to portfolio →</Link>
          </>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-gray-950 text-gray-100">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[440px] w-[860px] -translate-x-1/2 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,rgba(127,176,255,0.14),transparent_70%)] blur-2xl" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5"><div className="silhat-brand">A</div><span className="font-display font-bold tracking-tight text-gray-50">ailhat</span></Link>
      </header>
      <main className="relative z-10 px-6 py-16">{children}</main>
    </div>
  );
}
