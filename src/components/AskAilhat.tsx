import { Link } from "@tanstack/react-router";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "~/lib/useAuth";
import { useBrief } from "~/lib/useBrief";
import { useStore } from "~/lib/useStore";

interface GuideAnswer {
  text: string;
  action?: { label: string; to: string; productId?: string };
}

const QUICK_PROMPTS = [
  "What should I focus on next?",
  "What needs my attention?",
  "Am I ready to launch?",
  "Where should I review opportunities?",
] as const;

function productMatch(query: string, products: Array<{ id: string; name: string }>) {
  const lower = query.toLowerCase();
  return products.find((product) => lower.includes(product.name.toLowerCase()));
}

export default function AskAilhat() {
  const { user, loading } = useAuth();
  const { state } = useStore();
  const { signals, summary } = useBrief();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<GuideAnswer | null>(null);

  const openItems = useMemo(
    () => state.items.filter((item) => item.status !== "done"),
    [state.items],
  );

  if (loading || !user) return null;

  const respond = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    const matched = productMatch(q, state.products);

    if (matched) {
      const productSignals = signals.filter((signal) => signal.productId === matched.id);
      const productOpen = openItems.filter((item) => item.productId === matched.id);
      const highest = productSignals[0];
      setAnswer({
        text: highest
          ? `${matched.name} has ${productOpen.length} open item${productOpen.length === 1 ? "" : "s"}. The highest-ranked current signal is “${highest.title}”. ailhat recommends: ${highest.recommendation}`
          : `${matched.name} has ${productOpen.length} open item${productOpen.length === 1 ? "" : "s"}, and no currently ranked attention signal. Open the Product Cockpit to review its evidence, scans, decisions, and work in context.`,
        action: { label: `Open ${matched.name} cockpit`, to: "/product/$productId", productId: matched.id },
      });
      return;
    }

    if (/next|focus|priority|priorit|attention|today|do first/.test(lower)) {
      const highest = summary.highest;
      setAnswer(
        highest
          ? {
              text: `Your highest-leverage current signal is “${highest.title}”. ${highest.summary} Recommended next step: ${highest.recommendation}`,
              action: highest.productId
                ? { label: "Open product context", to: "/product/$productId", productId: highest.productId }
                : { label: "Open Today", to: "/dashboard" },
            }
          : {
              text: `No ranked signal currently needs immediate attention across ${state.products.length} active product${state.products.length === 1 ? "" : "s"}. Today is the best place to review composition and current work.`,
              action: { label: "Open Today", to: "/dashboard" },
            },
      );
      return;
    }

    if (/launch|ready|readiness|ship|users/.test(lower)) {
      setAnswer({
        text: "Launch Readiness lives in Intelligence because ailhat should separate observed evidence from assumptions. Review the evidence coverage there before treating a clean deployment or basic scan as proof that the full user journey works.",
        action: { label: "Review Launch Readiness", to: "/brief" },
      });
      return;
    }

    if (/idea|opportun|radar|market|route|spin out|absorb|extend|experiment/.test(lower)) {
      setAnswer({
        text: "Use RADAR in Intelligence to bring in an external signal, preserve its source, compare it against the portfolio, and route it as ABSORB, EXTEND, EXPERIMENT, WATCH, SPIN OUT, or REJECT before creating more product surface area.",
        action: { label: "Open Intelligence", to: "/brief" },
      });
      return;
    }

    if (/direct|prepare|execute|handoff|agent|implementation/.test(lower)) {
      setAnswer({
        text: "Direct is the governed handoff surface. Ask ailhat can help you decide what should happen and why, but execution remains separate. Open Direct when the work is sufficiently grounded and ready to prepare for a chosen harness.",
        action: { label: "Open Direct", to: "/control" },
      });
      return;
    }

    setAnswer({
      text: `I can navigate the evidence ailhat already has: ${state.products.length} active product${state.products.length === 1 ? "" : "s"}, ${openItems.length} open work item${openItems.length === 1 ? "" : "s"}, and ${signals.length} ranked attention signal${signals.length === 1 ? "" : "s"}. Ask what to focus on, name a product, ask about launch readiness, opportunities, or where work should go next.`,
      action: { label: "Open Today", to: "/dashboard" },
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    respond(query);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border border-[#7fb0ff]/40 bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-100 shadow-2xl shadow-black/40 transition hover:border-[#7fb0ff]/70 hover:bg-gray-800"
        aria-expanded={open}
        aria-controls="ask-ailhat-panel"
      >
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#7fb0ff]/15 text-[#7fb0ff]">✦</span>
        Ask ailhat
      </button>

      {open && (
        <aside
          id="ask-ailhat-panel"
          className="fixed bottom-20 right-5 z-50 w-[min(390px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 shadow-2xl shadow-black/60"
          aria-label="Ask ailhat"
        >
          <div className="border-b border-gray-800 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="silhat-eyebrow text-[#7fb0ff]">Portfolio navigator</p>
                <h2 className="mt-1 text-base font-bold text-gray-100">Ask ailhat</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Grounded guidance over your current ailhat state. Recommends and routes; does not execute work.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-900 hover:text-gray-200"
                aria-label="Close Ask ailhat"
              >
                ×
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4">
            {!answer && (
              <div className="mb-4 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => {
                      setQuery(prompt);
                      respond(prompt);
                    }}
                    className="rounded-full border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-700 hover:text-gray-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {answer && (
              <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/70 p-4">
                <p className="text-sm leading-6 text-gray-300">{answer.text}</p>
                {answer.action && (
                  answer.action.productId ? (
                    <Link
                      to="/product/$productId"
                      params={{ productId: answer.action.productId }}
                      onClick={() => setOpen(false)}
                      className="mt-3 inline-flex text-xs font-semibold text-[#7fb0ff] hover:underline"
                    >
                      {answer.action.label} →
                    </Link>
                  ) : (
                    <Link
                      to={answer.action.to as "/dashboard" | "/brief" | "/control"}
                      onClick={() => setOpen(false)}
                      className="mt-3 inline-flex text-xs font-semibold text-[#7fb0ff] hover:underline"
                    >
                      {answer.action.label} →
                    </Link>
                  )
                )}
              </div>
            )}

            <form onSubmit={submit} className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="What should I do next?"
                className="min-w-0 flex-1 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-[#7fb0ff]/50"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#7fb0ff] px-3.5 py-2.5 text-sm font-bold text-gray-950 hover:brightness-110"
              >
                Ask
              </button>
            </form>
          </div>
        </aside>
      )}
    </>
  );
}
