import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import AgentJourneyReadiness from "~/components/AgentJourneyReadiness";
import IntelligenceExpansion from "~/components/IntelligenceExpansion";
import { useStore } from "~/lib/useStore";
import {
  loadSolutionWorkflows,
  setSolutionWorkflowStage,
  startSolutionWorkflow,
  subscribeSolutionWorkflows,
  type SolutionWorkflow,
  type SolutionWorkflowStage,
} from "~/lib/solution-workflow";

const STAGES: { id: SolutionWorkflowStage; label: string }[] = [
  { id: "review", label: "Review" },
  { id: "solution", label: "Solution" },
  { id: "prepared", label: "Prepare" },
  { id: "implementation", label: "Implement" },
  { id: "verify", label: "Verify" },
  { id: "resolved", label: "Resolved" },
];

const rank: Record<SolutionWorkflowStage, number> = {
  review: 0,
  solution: 1,
  prepared: 2,
  implementation: 3,
  verify: 4,
  resolved: 5,
};

function sourceLabel(workflow: SolutionWorkflow) {
  if (workflow.source === "scan-finding") return "from scan evidence";
  if (workflow.source === "external-opportunity") return "from external opportunity routing";
  return "added after scan";
}

function WorkflowRail({ stage }: { stage: SolutionWorkflowStage }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {STAGES.map((step, index) => (
        <div key={step.id} className="flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider ${
              rank[step.id] <= rank[stage]
                ? "border-[#7fb0ff]/35 bg-[#7fb0ff]/10 text-[#9cc8ff]"
                : "border-gray-800 bg-gray-950 text-gray-600"
            }`}
          >
            {step.label}
          </span>
          {index < STAGES.length - 1 && <span className="text-[10px] text-gray-700">→</span>}
        </div>
      ))}
    </div>
  );
}

function SolutionWorkflowState() {
  const location = useLocation();
  const { state, ready } = useStore();
  const [workflows, setWorkflows] = useState<SolutionWorkflow[]>([]);
  const initialized = useRef(false);
  const seenItems = useRef<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () => setWorkflows(loadSolutionWorkflows());
    refresh();
    return subscribeSolutionWorkflows(refresh);
  }, []);

  useEffect(() => {
    if (!ready || initialized.current) return;
    seenItems.current = new Set(state.items.map((item) => item.id));
    initialized.current = true;
  }, [ready, state.items]);

  useEffect(() => {
    if (!ready || !initialized.current) return;
    let changed = false;
    for (const item of state.items) {
      if (seenItems.current.has(item.id)) continue;
      seenItems.current.add(item.id);
      if (item.type === "feature") continue;
      const product = state.products.find((candidate) => candidate.id === item.productId);
      const hasScanEvidence = !!state.scanHistory?.[item.productId]?.lastGood;
      if (!product || !hasScanEvidence) continue;
      startSolutionWorkflow(product, item);
      changed = true;
    }
    if (changed) setWorkflows(loadSolutionWorkflows());
  }, [ready, state.items, state.products, state.scanHistory]);

  useEffect(() => {
    if (!ready || workflows.length === 0) return;
    let changed = false;
    for (const workflow of workflows) {
      if (workflow.stage === "resolved" || workflow.stage === "verify") continue;
      const item = state.items.find((candidate) => candidate.id === workflow.itemId);
      if (item?.status === "done") {
        setSolutionWorkflowStage(workflow.id, "verify");
        changed = true;
      }
    }
    if (changed) setWorkflows(loadSolutionWorkflows());
  }, [ready, state.items, workflows]);

  const active = useMemo(
    () => workflows.find((workflow) => workflow.stage !== "resolved"),
    [workflows],
  );

  const activeHistory = active ? state.scanHistory?.[active.productId] : undefined;
  const activeFinding =
    active?.scanKey && activeHistory ? activeHistory.issues?.[active.scanKey] : undefined;

  useEffect(() => {
    if (!active || active.stage !== "verify" || !active.scanKey || !activeFinding) return;
    if (!activeFinding.present) {
      setSolutionWorkflowStage(active.id, "resolved");
      setWorkflows(loadSolutionWorkflows());
    }
  }, [active, activeFinding]);

  if (!active) return null;

  const onProduct =
    location.pathname === `/product/${encodeURIComponent(active.productId)}` ||
    location.pathname === `/product/${active.productId}`;
  const onDirect = location.pathname === "/control";
  const item = state.items.find((candidate) => candidate.id === active.itemId);

  const setStage = (stage: SolutionWorkflowStage) => {
    setSolutionWorkflowStage(active.id, stage);
    setWorkflows(loadSolutionWorkflows());
  };

  return (
    <section
      id="solution-workflow"
      className={`mb-5 rounded-xl border px-4 py-4 ${
        active.stage === "verify"
          ? "border-amber-400/25 bg-amber-400/[0.05]"
          : "border-[#7fb0ff]/25 bg-[#7fb0ff]/[0.05]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="silhat-eyebrow">Solution workflow · continuity</p>
          <h2 className="mt-1 text-sm font-semibold text-gray-100">{active.itemTitle}</h2>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {active.productName} · {sourceLabel(active)}
            {item ? ` · checklist ${item.status.replace("_", " ")}` : ""}
          </p>
        </div>
        <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-gray-400">
          {active.stage}
        </span>
      </div>

      <WorkflowRail stage={active.stage} />

      {active.stage === "verify" && (
        <p className="mt-3 text-sm leading-6 text-amber-100/90">
          Implementation is marked done. Re-scan {active.productName} before calling this resolved. Fresh evidence should either close the finding or return it as regressed.
        </p>
      )}

      {onDirect && (
        <p className="mt-3 text-sm leading-6 text-gray-300">
          Direct is continuing the linked issue above. Prepare or export the agent instruction here; doing so is not the same as execution or verification.
        </p>
      )}

      {onProduct && (
        <p className="mt-3 text-sm leading-6 text-gray-300">
          This Product Cockpit is the canonical context for the workflow. Its signals, checklist, scan history, findings, and prepared work are the same records carried through Today, Intelligence, and Direct.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!onProduct && (
          <Link
            to="/product/$productId"
            params={{ productId: active.productId }}
            onClick={() => setStage("solution")}
            className="silhat-btn silhat-btn-primary"
          >
            Open solution workflow →
          </Link>
        )}
        {onProduct && active.stage !== "verify" && (
          <Link
            to="/control"
            onClick={() => setStage("prepared")}
            className="silhat-btn silhat-btn-primary"
          >
            Open Direct to prepare →
          </Link>
        )}
        {onDirect && rank[active.stage] < rank.implementation && (
          <button
            type="button"
            onClick={() => setStage("implementation")}
            className="silhat-btn silhat-btn-ghost"
          >
            Direction handed off / implementing
          </button>
        )}
        {active.stage === "verify" && (
          <Link
            to="/product/$productId"
            params={{ productId: active.productId }}
            className="silhat-btn silhat-btn-primary"
          >
            Re-scan in Product Cockpit →
          </Link>
        )}
      </div>
    </section>
  );
}

export default function SolutionWorkflowBridge() {
  const location = useLocation();

  return (
    <>
      {location.pathname === "/brief" && <IntelligenceExpansion />}
      <AgentJourneyReadiness />
      <SolutionWorkflowState />
    </>
  );
}
