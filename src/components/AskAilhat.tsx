import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "~/lib/useAuth";
import { useBrief } from "~/lib/useBrief";
import { useStore } from "~/lib/useStore";
import type { ContextEnvelope } from "~/lib/context-envelope";
import {
  addContextEnvelope,
  createUserContextEnvelope,
  loadContextEnvelopes,
  subscribeContextEnvelopes,
} from "~/lib/context-store";

interface GuideAction {
  label: string;
  to: "/dashboard" | "/brief" | "/control" | "/connections" | "/product/$productId";
  productId?: string;
}

interface GuideAnswer {
  text: string;
  action: GuideAction;
}

interface WorkingContext {
  productId?: string;
  goal?: string;
  constraint?: string;
}

const CONTEXT_KEY = "ailhat.ask-working-context.v1";

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

function loadContext(): WorkingContext {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(CONTEXT_KEY) ?? "{}") as unknown;
    return value && typeof value === "object" ? (value as WorkingContext) : {};
  } catch {
    return {};
  }
}

function saveContext(context: WorkingContext) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // Working focus is facilitation state only; storage failure must not affect evidence.
  }
}

function contextLens(items: ContextEnvelope[]): WorkingContext {
  const active = items.filter((item) => item.verificationStatus !== "disputed" && item.verificationStatus !== "stale");
  const focus = active.find((item) => item.contextType === "focus" && item.subjectType === "product" && item.subjectId);
  const goal = active.find((item) => item.contextType === "goal");
  const constraint = active.find((item) => item.contextType === "constraint");
  return {
    productId: focus?.subjectId,
    goal: goal?.content,
    constraint: constraint?.content,
  };
}

function inferredGoal(lower: string): string | undefined {
  if (/launch|ship|ready for users|go live/.test(lower)) return "Launch";
  if (/customer|acquisition|sales|revenue|paying user|paying customer/.test(lower)) return "Acquisition";
  if (/retention|engagement/.test(lower)) return "Retention";
  if (/polish|design|brand|ui|ux/.test(lower)) return "Product quality";
  if (/validate|validation|experiment/.test(lower)) return "Validation";
  return undefined;
}

function inferredConstraint(raw: string): string | undefined {
  const time = raw.match(/\b(?:only\s+)?(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|minute|minutes|min|mins)\b/i);
  if (time) return `${time[1]} ${time[2]}`;
  if (/no new features|don't recommend new features|do not recommend new features/i.test(raw)) return "No new features";
  if (/ignore polish|not polish|skip polish/i.test(raw)) return "Deprioritize polish";
  return undefined;
}

export default function AskAilhat() {
  const { user, loading } = useAuth();
  const { state } = useStore();
  const { signals, summary } = useBrief();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<GuideAnswer | null>(null);
  const [context, setContext] = useState<WorkingContext>({});
  const [envelopes, setEnvelopes] = useState<ContextEnvelope[]>([]);

  useEffect(() => {
    const refresh = () => {
      const nextEnvelopes = loadContextEnvelopes();
      setEnvelopes(nextEnvelopes);
      const stored = loadContext();
      const shared = contextLens(nextEnvelopes);
      const merged = { ...stored, ...shared };
      setContext(merged);
      saveContext(merged);
    };
    refresh();
    return subscribeContextEnvelopes(refresh);
  }, []);

  const openItems = useMemo(
    () => state.items.filter((item) => item.status !== "done"),
    [state.items],
  );

  const focusProduct = context.productId
    ? state.products.find((product) => product.id === context.productId)
    : undefined;

  if (loading || !user) return null;

  const updateContext = (patch: Partial<WorkingContext>, writeEnvelope = true) => {
    const next = { ...context, ...patch };
    for (const key of Object.keys(next) as Array<keyof WorkingContext>) {
      if (!next[key]) delete next[key];
    }
    setContext(next);
    saveContext(next);

    if (writeEnvelope) {
      const subjectProduct = next.productId ? state.products.find((product) => product.id === next.productId) : undefined;
      if (patch.productId) {
        const product = state.products.find((candidate) => candidate.id === patch.productId);
        if (product) {
          addContextEnvelope(createUserContextEnvelope({
            contextType: "focus",
            content: `${product.name} is the current working focus.`,
            subjectType: "product",
            subjectId: product.id,
            scope: "shared",
            domain: "portfolio-intelligence",
            extensions: { productName: product.name, capturedVia: "Ask ailhat" },
          }));
        }
      }
      if (patch.goal) {
        addContextEnvelope(createUserContextEnvelope({
          contextType: "goal",
          content: patch.goal,
          subjectType: subjectProduct ? "product" : "portfolio",
          subjectId: subjectProduct?.id,
          scope: "shared",
          domain: "portfolio-intelligence",
          extensions: { capturedVia: "Ask ailhat" },
        }));
      }
      if (patch.constraint) {
        addContextEnvelope(createUserContextEnvelope({
          contextType: "constraint",
          content: patch.constraint,
          subjectType: subjectProduct ? "product" : "portfolio",
          subjectId: subjectProduct?.id,
          scope: "shared",
          domain: "portfolio-intelligence",
          extensions: { capturedVia: "Ask ailhat" },
        }));
      }
    }
    return next;
  };

  const answerForProduct = (product: { id: string; name: string }, working: WorkingContext): GuideAnswer => {
    const productSignals = signals.filter((signal) => signal.productId === product.id);
    const productOpen = openItems.filter((item) => item.productId === product.id);
    const relevantContext = envelopes.filter(
      (item) => item.subjectType === "portfolio" || (item.subjectType === "product" && item.subjectId === product.id),
    );
    const highest = productSignals[0];
    const qualifiers = [working.goal ? `goal: ${working.goal}` : "", working.constraint ? `constraint: ${working.constraint}` : ""]
      .filter(Boolean)
      .join(" · ");
    const contextNote = relevantContext.length > 0
      ? ` ${relevantContext.length} supplied context item${relevantContext.length === 1 ? " is" : "s are"} attached; focus, goal, and constraint context affect this working lens while evidence remains separately verified.`
      : "";

    return {
      text: highest
        ? `I’m prioritizing within ${product.name}${qualifiers ? ` (${qualifiers})` : ""}. It has ${productOpen.length} open item${productOpen.length === 1 ? "" : "s"}; the highest-ranked current signal is “${highest.title}”. ${highest.recommendation}${contextNote}`
        : `I’m prioritizing within ${product.name}${qualifiers ? ` (${qualifiers})` : ""}. It has ${productOpen.length} open item${productOpen.length === 1 ? "" : "s"} and no currently ranked attention signal. Review its Product Cockpit before inventing new work.${contextNote}`,
      action: { label: `Resolve in ${product.name} cockpit`, to: "/product/$productId", productId: product.id },
    };
  };

  const respond = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    const lower = q.toLowerCase();

    if (/reset focus|clear focus|clear context|portfolio-wide/.test(lower)) {
      updateContext({ productId: undefined, goal: undefined, constraint: undefined }, false);
      setAnswer({
        text: "Working focus cleared for this navigator. Saved context envelopes remain available until you remove them from Add Context.",
        action: { label: "Review portfolio-wide priorities", to: "/dashboard" },
      });
      return;
    }

    const matched = productMatch(q, state.products);
    const goal = inferredGoal(lower);
    const constraint = inferredConstraint(q);
    const declaresFocus = /focus(?:ed|ing)?\s+(?:on|in)|working\s+on|prioriti[sz](?:e|ing)\s+|this week.*(?:on|is)|for now.*(?:on|is)/i.test(q);
    const declaresGoal = /my goal|goal is|focused on .*launch|focused on .*customer|trying to|need to/.test(lower);

    let working = context;
    const patch: Partial<WorkingContext> = {};
    if (matched && declaresFocus) patch.productId = matched.id;
    if (goal && (declaresGoal || declaresFocus)) patch.goal = goal;
    if (constraint) patch.constraint = constraint;
    if (Object.keys(patch).length > 0) working = updateContext(patch);

    const activeProduct = matched ?? (working.productId ? state.products.find((p) => p.id === working.productId) : undefined);

    if (matched && declaresFocus) {
      setAnswer({
        ...answerForProduct(matched, working),
        text: `Got it — ${matched.name} is now the working focus${working.goal ? `, with ${working.goal.toLowerCase()} as the goal` : ""}${working.constraint ? ` and ${working.constraint} as a constraint` : ""}. I saved that lens as transferable user-supplied context. ${answerForProduct(matched, working).text}`,
      });
      return;
    }

    if (activeProduct && /next|focus|priority|priorit|attention|today|do first|what should i do/.test(lower)) {
      setAnswer(answerForProduct(activeProduct, working));
      return;
    }

    if (matched) {
      setAnswer(answerForProduct(matched, working));
      return;
    }

    if (/next|focus|priority|priorit|attention|today|do first|what should i do/.test(lower)) {
      const highest = summary.highest;
      setAnswer(
        highest
          ? {
              text: `Portfolio-wide, the highest-leverage current signal is “${highest.title}”. ${highest.summary} Recommended next step: ${highest.recommendation}${working.goal ? ` I’m also keeping your ${working.goal.toLowerCase()} goal in view.` : ""}${working.constraint ? ` Constraint in view: ${working.constraint}.` : ""}`,
              action: highest.productId
                ? { label: "Resolve in Product Cockpit", to: "/product/$productId", productId: highest.productId }
                : { label: "Review current priorities", to: "/dashboard" },
            }
          : {
              text: `No ranked signal currently needs immediate attention across ${state.products.length} active product${state.products.length === 1 ? "" : "s"}. Review Today rather than creating work without evidence.`,
              action: { label: "Review Today", to: "/dashboard" },
            },
      );
      return;
    }

    if (/launch|ready|readiness|ship|users/.test(lower)) {
      setAnswer({
        text: activeProduct
          ? `For ${activeProduct.name}, use Launch Readiness to separate verified evidence from unknowns, then resolve product-specific blockers in its cockpit.`
          : "Launch Readiness lives in Intelligence because ailhat separates observed evidence from assumptions. Review evidence coverage before treating a clean deployment or basic scan as proof that the full user journey works.",
        action: { label: "Review Launch Readiness", to: "/brief" },
      });
      return;
    }

    if (/idea|opportun|radar|market|route|spin out|absorb|extend|experiment/.test(lower)) {
      setAnswer({
        text: `Use RADAR in Intelligence to preserve the source, compare the opportunity against ${focusProduct ? `${focusProduct.name} and the wider portfolio` : "the portfolio"}, and route it before creating more product surface area.`,
        action: { label: "Route in RADAR", to: "/brief" },
      });
      return;
    }

    if (/connection|github|vercel|analytics|source|sync/.test(lower)) {
      setAnswer({
        text: "Connections is where evidence sources, permissions, product scope, and sync health belong. Declared integrations are not treated as connected until a real adapter succeeds.",
        action: { label: "Review Connections", to: "/connections" },
      });
      return;
    }

    if (/direct|prepare|execute|handoff|agent|implementation/.test(lower)) {
      setAnswer({
        text: "Direct is the governed handoff surface. Ask ailhat can help decide what should happen and why; preparation and execution remain explicit downstream states.",
        action: { label: "Continue in Direct", to: "/control" },
      });
      return;
    }

    if (goal || constraint) {
      setAnswer({
        text: `I’ve incorporated ${goal ? `the ${goal.toLowerCase()} goal` : "your stated goal"}${constraint ? ` and the ${constraint} constraint` : ""} into the working context and saved it as transferable user-supplied context. Ask “what should I do next?” and I’ll rerank through that lens.`,
        action: activeProduct
          ? { label: `Review ${activeProduct.name}`, to: "/product/$productId", productId: activeProduct.id }
          : { label: "Review Today", to: "/dashboard" },
      });
      return;
    }

    setAnswer({
      text: `I can navigate ${state.products.length} active product${state.products.length === 1 ? "" : "s"}, ${openItems.length} open work item${openItems.length === 1 ? "" : "s"}, ${signals.length} ranked attention signal${signals.length === 1 ? "" : "s"}, and ${envelopes.length} supplied context envelope${envelopes.length === 1 ? "" : "s"}. Tell me what product, goal, or constraint you are focused on and later recommendations will acknowledge it.`,
      action: { label: "Review Today", to: "/dashboard" },
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    respond(query);
  };

  const chips = [
    focusProduct ? { key: "productId" as const, label: `Focus: ${focusProduct.name}` } : null,
    context.goal ? { key: "goal" as const, label: `Goal: ${context.goal}` } : null,
    context.constraint ? { key: "constraint" as const, label: `Constraint: ${context.constraint}` } : null,
  ].filter(Boolean) as Array<{ key: keyof WorkingContext; label: string }>;

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
          className="fixed bottom-20 right-5 z-50 w-[min(410px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 shadow-2xl shadow-black/60"
          aria-label="Ask ailhat"
        >
          <div className="border-b border-gray-800 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="silhat-eyebrow text-[#7fb0ff]">Portfolio navigator</p>
                <h2 className="mt-1 text-base font-bold text-gray-100">Ask ailhat</h2>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Guidance over evidence + shared working context. Recommends and routes; does not execute work.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-900 hover:text-gray-200" aria-label="Close Ask ailhat">×</button>
            </div>
            {chips.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => updateContext({ [chip.key]: undefined }, false)}
                    className="rounded-full border border-[#7fb0ff]/25 bg-[#7fb0ff]/[0.06] px-2.5 py-1 text-[10px] font-semibold text-[#9cc8ff]"
                    title="Remove from this working lens"
                  >
                    {chip.label} ×
                  </button>
                ))}
                <button type="button" onClick={() => { updateContext({ productId: undefined, goal: undefined, constraint: undefined }, false); setAnswer(null); }} className="px-2 py-1 text-[10px] font-semibold text-gray-600 hover:text-gray-300">
                  Reset lens
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-4">
            {!answer && (
              <div className="mb-4 flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => { setQuery(prompt); respond(prompt); }} className="rounded-full border border-gray-800 bg-gray-900 px-3 py-1.5 text-xs text-gray-400 hover:border-gray-700 hover:text-gray-200">
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {answer && (
              <div className="mb-4 rounded-xl border border-gray-800 bg-gray-900/70 p-4">
                <p className="text-sm leading-6 text-gray-300">{answer.text}</p>
                {answer.action.to === "/product/$productId" && answer.action.productId ? (
                  <Link to="/product/$productId" params={{ productId: answer.action.productId }} onClick={() => setOpen(false)} className="mt-3 inline-flex rounded-lg bg-[#7fb0ff]/10 px-3 py-2 text-xs font-semibold text-[#9cc8ff] hover:bg-[#7fb0ff]/15">
                    {answer.action.label} →
                  </Link>
                ) : (
                  <Link to={answer.action.to as "/dashboard" | "/brief" | "/control" | "/connections"} onClick={() => setOpen(false)} className="mt-3 inline-flex rounded-lg bg-[#7fb0ff]/10 px-3 py-2 text-xs font-semibold text-[#9cc8ff] hover:bg-[#7fb0ff]/15">
                    {answer.action.label} →
                  </Link>
                )}
              </div>
            )}

            <form onSubmit={submit} className="flex gap-2">
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={focusProduct ? `Ask about ${focusProduct.name}…` : "What should I do next?"} className="min-w-0 flex-1 rounded-xl border border-gray-800 bg-gray-900 px-3 py-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-600 focus:border-[#7fb0ff]/50" />
              <button type="submit" className="rounded-xl bg-[#7fb0ff] px-3.5 py-2.5 text-sm font-bold text-gray-950 hover:brightness-110">Ask</button>
            </form>
            <p className="mt-2 text-[10px] leading-4 text-gray-600">User context shapes recommendations; it does not overwrite scan evidence or silently mark work resolved.</p>
          </div>
        </aside>
      )}
    </>
  );
}
