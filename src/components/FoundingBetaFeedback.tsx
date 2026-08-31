import { useEffect, useState } from "react";

export function FoundingBetaFeedback() {
  const [eligible, setEligible] = useState(false);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("observation");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    let alive = true;
    fetch("/api/access", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: { access?: { foundingBeta?: boolean; role?: string } } | null) => {
        if (!alive) return;
        setEligible(Boolean(data?.access?.foundingBeta) && data?.access?.role !== "owner");
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, []);

  if (!eligible) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    try {
      const response = await fetch("/api/beta/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          message,
          route: typeof window === "undefined" ? null : window.location.pathname + window.location.search,
        }),
      });
      if (!response.ok) throw new Error("feedback_failed");
      setStatus("sent");
      setMessage("");
      window.setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 900);
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[80] rounded-full border border-[#7fb0ff]/30 bg-gray-950/95 px-4 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9dc2ff] shadow-2xl backdrop-blur hover:border-[#7fb0ff]/60"
      >
        Founding Beta · Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/70 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="beta-feedback-title" onClick={() => setOpen(false)}>
          <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-gray-800 bg-gray-950 p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7fb0ff]">Founding Beta</p>
                <h2 id="beta-feedback-title" className="mt-2 text-xl font-semibold text-gray-100">Tell ailhat what happened.</h2>
                <p className="mt-1 text-sm leading-6 text-gray-500">Short, candid feedback is part of the beta exchange. Route context is attached; your portfolio content is not.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-xl text-gray-600 hover:text-gray-300" aria-label="Close">×</button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ["worked", "Worked"],
                ["confusing", "Confusing"],
                ["broke", "Broke"],
              ].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${category === value ? "border-[#7fb0ff]/50 bg-[#7fb0ff]/10 text-[#b8d2ff]" : "border-gray-800 text-gray-500"}`}>
                  {label}
                </button>
              ))}
            </div>

            <textarea
              required
              rows={6}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="What worked, confused you, broke, or should change?"
              className="mt-4 w-full resize-y rounded-xl border border-gray-800 bg-gray-900 p-3 text-sm leading-6 text-gray-200 outline-none focus:border-[#7fb0ff]"
            />

            {status === "error" && <p className="mt-3 text-sm text-rose-400">Feedback couldn't be saved. Please try again.</p>}
            {status === "sent" && <p className="mt-3 text-sm text-emerald-400">Saved. Thank you.</p>}

            <button type="submit" disabled={status === "sending" || !message.trim()} className="silhat-btn silhat-btn-primary mt-4 w-full rounded-xl px-4 py-3 disabled:opacity-50">
              {status === "sending" ? "Sending…" : "Send feedback"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
