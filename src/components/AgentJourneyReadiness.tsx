import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "~/lib/useStore";

interface AgentJourney {
  id: string;
  productId: string;
  title: string;
  outcome: string;
  status: "defined" | "needs-test";
  createdAt: number;
}

const KEY = "ailhat.agent-journeys.v1";
const TEMPLATES = [
  { title: "Discover and understand the offering", outcome: "An agent can identify what the product does, who it is for, and the primary next action without guessing." },
  { title: "Complete the primary conversion path", outcome: "An agent can reach and complete the product's primary signup, request, booking, or purchase path when authorization permits." },
  { title: "Find and invoke the right action", outcome: "An agent can identify the correct structured action or interface rather than relying on brittle visual interaction." },
  { title: "Recover from a blocked step", outcome: "When an action cannot complete, the product exposes enough state and guidance for the agent to recover or escalate safely." },
];

function loadJourneys(): AgentJourney[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AgentJourney[]) : [];
  } catch {
    return [];
  }
}

function saveJourneys(items: AgentJourney[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Facilitation state only. Never mutate product evidence if storage fails.
  }
}

export default function AgentJourneyReadiness() {
  const location = useLocation();
  const { state } = useStore();
  const [journeys, setJourneys] = useState<AgentJourney[]>([]);

  useEffect(() => setJourneys(loadJourneys()), []);

  const isLearn = location.pathname === "/learn";
  const match = location.pathname.match(/^\/product\/([^/]+)$/);
  const productId = match ? decodeURIComponent(match[1]) : null;
  const product = productId ? state.products.find((p) => p.id === productId) : null;
  const productJourneys = useMemo(
    () => (productId ? journeys.filter((journey) => journey.productId === productId) : []),
    [journeys, productId],
  );

  if (!isLearn && !product) return null;

  const addTemplate = (title: string, outcome: string) => {
    if (!product) return;
    if (journeys.some((journey) => journey.productId === product.id && journey.title === title)) return;
    const next: AgentJourney[] = [
      ...journeys,
      {
        id: `${product.id}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        productId: product.id,
        title,
        outcome,
        status: "needs-test",
        createdAt: Date.now(),
      },
    ];
    setJourneys(next);
    saveJourneys(next);
  };

  if (isLearn) {
    const first = state.products[0];
    return (
      <section className="mb-6 rounded-xl border border-[#7fb0ff]/20 bg-[#7fb0ff]/[0.04] p-5">
        <p className="silhat-eyebrow">Agent Journey Readiness · emerging capability</p>
        <h2 className="mt-1 text-lg font-semibold text-gray-100">Can an agent actually complete the job?</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-400">
          Traditional site health asks whether a page works for a person. Agent Journey Readiness asks whether an agent can discover the product, understand the offering, find the right action, complete the intended journey safely, and recover when something blocks it. WebMCP and other structured action surfaces can make those journeys more reliable, but the product outcome matters more than any one protocol.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {["Discover", "Understand", "Act", "Recover"].map((label, index) => (
            <div key={label} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">0{index + 1}</span>
              <div className="mt-1 text-sm font-semibold text-gray-200">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-xs leading-5 text-gray-400">
            <strong className="text-gray-200">ailhat owns readiness.</strong> Define critical journeys, observe where they stall, turn failures into findings, prepare work, then re-test.
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-xs leading-5 text-gray-400">
            <strong className="text-gray-200">ALVIRA supplies context.</strong> It can help an authorized agent understand the person, goals, constraints, and preferences relevant to the action.
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-xs leading-5 text-gray-400">
            <strong className="text-gray-200">LEDGATo governs action.</strong> Authorization and evidence stay separate from whether the product is technically agent-operable.
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {first ? (
            <Link to="/product/$productId" params={{ productId: first.id }} hash="agent-journeys" className="silhat-btn silhat-btn-primary">
              Define a journey on {first.name} →
            </Link>
          ) : (
            <Link to="/dashboard" className="silhat-btn silhat-btn-primary">Add a product first →</Link>
          )}
          <span className="text-[11px] text-gray-600">Journey definitions are real. Automated agent execution is not claimed until a runner is connected.</span>
        </div>
      </section>
    );
  }

  return (
    <section id="agent-journeys" className="mb-6 rounded-xl border border-[#7fb0ff]/20 bg-[#7fb0ff]/[0.035] p-5">
      <p className="silhat-eyebrow">Agent journeys · {product?.name}</p>
      <h2 className="mt-1 text-lg font-semibold text-gray-100">Define what an agent should be able to accomplish</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
        These journeys become the future test cases for agent-readiness scans. A failed journey should enter the same ailhat loop as any other finding: Review → Solution → Prepare → Implement → Verify.
      </p>

      {productJourneys.length > 0 && (
        <div className="mt-4 space-y-2">
          {productJourneys.map((journey) => (
            <article key={journey.id} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{journey.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{journey.outcome}</p>
                </div>
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">Needs test</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-500">Suggested journeys</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {TEMPLATES.map((template) => {
            const added = productJourneys.some((journey) => journey.title === template.title);
            return (
              <button
                key={template.title}
                type="button"
                disabled={added}
                onClick={() => addTemplate(template.title, template.outcome)}
                className="rounded-lg border border-gray-800 bg-gray-950/60 p-3 text-left transition hover:border-[#7fb0ff]/35 disabled:cursor-default disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-gray-200">{added ? "Added · " : "+ "}{template.title}</span>
                <span className="mt-1 block text-xs leading-5 text-gray-500">{template.outcome}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-4 border-t border-gray-800 pt-3 text-[11px] leading-5 text-gray-600">
        Current state: journey definition and facilitation. A future agent runner should execute these cases, record each stall with evidence, and create normal ailhat findings that feed Direct and re-test verification.
      </p>
    </section>
  );
}
