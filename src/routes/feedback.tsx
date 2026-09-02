import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider } from "~/lib/useStore";
import AppShell from "~/components/AppShell";

export const Route = createFileRoute("/feedback")({
  component: () => <AuthProvider><StoreProvider><AppShell active="today"><FeedbackPage /></AppShell></StoreProvider></AuthProvider>,
});

function FeedbackPage() {
  const { user, access, loading } = useAuth();
  const [category, setCategory] = useState("observation");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  if (loading) return <p className="py-20 text-center text-gray-500">Loading…</p>;
  if (!user || !access?.productAccess) return <section className="silhat-panel p-8 text-center"><h1 className="text-xl font-semibold">Active access required</h1><Link to="/login" className="silhat-btn silhat-btn-primary mt-4 inline-flex">Log in</Link></section>;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true); setStatus("");
    try {
      const response = await fetch("/api/beta/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, message, route: typeof window === "undefined" ? null : window.location.pathname }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) { setStatus(data.error ?? "Feedback could not be saved."); return; }
      setMessage("");
      setStatus("Feedback saved. Thank you — it is attached to your account and this route only, not to your portfolio contents.");
    } finally { setSending(false); }
  };

  return <div className="mx-auto max-w-2xl space-y-6">
    <section><p className="silhat-eyebrow">Founding Beta · feedback</p><h1 className="mt-1 text-3xl font-bold text-gray-50">What should ailhat learn from your experience?</h1><p className="mt-2 text-sm leading-6 text-gray-400">Share friction, confusion, missing value, or something that worked unusually well. Feedback stores this message, its category, your account, and the route—not your portfolio contents.</p></section>
    <form onSubmit={submit} className="silhat-panel p-6">
      <label className="block text-sm text-gray-300">Category<select value={category} onChange={(e) => setCategory(e.target.value)} className="silhat-input mt-1"><option value="observation">Observation</option><option value="friction">Friction</option><option value="missing-value">Missing value</option><option value="confusing">Confusing</option><option value="delight">Worked well</option><option value="bug">Bug</option></select></label>
      <label className="mt-4 block text-sm text-gray-300">Feedback<textarea required minLength={3} value={message} onChange={(e) => setMessage(e.target.value)} className="silhat-input mt-1 min-h-40" placeholder="What happened, what did you expect, and what would have made this more useful?" /></label>
      {status && <p className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2 text-sm text-gray-300">{status}</p>}
      <button type="submit" disabled={sending || message.trim().length < 3} className="silhat-btn silhat-btn-primary mt-4 disabled:opacity-50">{sending ? "Saving…" : "Send feedback"}</button>
    </form>
  </div>;
}
