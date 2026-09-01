import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import AgentJourneyReadiness from "~/components/AgentJourneyReadiness";
import IntelligenceExpansion from "~/components/IntelligenceExpansion";
import { useStore } from "~/lib/useStore";
import { buildSignalWorkItem } from "~/lib/signal-work-item";
import { savePreparedWorkItem } from "~/lib/prepared-work";
import type { Signal } from "~/lib/brief";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // Completing implementation starts verification; it does not resolve the work.
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

  // Evidence reconciliation. A verification result only counts when it comes from
  // a successful scan that happened AFTER verification was requested. A resolved
  // scan-backed finding reopens if a later successful scan observes it again.
  useEffect(() => {
    if (!ready || workflows.length === 0) return;
    let changed = false;

    for (const workflow of workflows) {
      const history = state.scanHistory?.[workflow.productId];
      const scanAt = history?.lastGood?.scannedAt ?? 0;
      if (!scanAt) continue;
      const finding = workflow.scanKey ? history?.issues?.[workflow.scanKey] : undefined;

      if (workflow.stage === "verify") {
        const requestedAt = Date.parse(workflow.verifyRequestedAt ?? workflow.updatedAt);
        if (!Number.isFinite(requestedAt) || scanAt <= requestedAt || !workflow.scanKey || !finding) {
          continue;
        }
        setSolutionWorkflowStage(workflow.id, finding.present ? "solution" : "resolved");
        changed = true;
        continue;
      }

      if (workflow.stage === "resolved" && workflow.scanKey && finding?.present) {
        const resolvedAt = Date.parse(workflow.updatedAt);
        if (Number.isFinite(resolvedAt) && scanAt > resolvedAt) {
          setSolutionWorkflowStage(workflow.id, "solution");
          changed = true;
        }
      }
    }

    if (changed) setWorkflows(loadSolutionWorkflows());
  }, [ready, state.scanHistory, workflows]);

  const activeWorkflows = useMemo(
    () => workflows.filter((workflow) => workflow.stage !== "resolved"),
    [workflows],
  );

  const active = useMemo(() => {
    if (selectedId) {
      const selected = activeWorkflows.find((workflow) => workflow.id === selectedId);
      if (selected) return selected;
    }
    return activeWorkflows[0];
  }, [activeWorkflows, selectedId]);

  useEffect(() => {
    if (!active) {
      if (selectedId) setSelectedId(null);
      return;
    }
    if (selectedId !== active.id) setSelectedId(active.id);
  }, [active, selectedId]);

  if (!active) return null;

  const activeHistory = state.scanHistory?.[active.productId];
  const activeFinding =
    active.scanKey && activeHistory ? activeHistory.issues?.[active.scanKey] : undefined;
  const latestGoodAt = activeHistory?.lastGood?.scannedAt ?? 0;
  const verifyRequestedAt = Date.parse(active.verifyRequestedAt ?? active.updatedAt);
  const hasFreshVerificationScan =
    active.stage === "verify" &&
    Number.isFinite(verifyRequestedAt) &&
    latestGoodAt > verifyRequestedAt;

  const onProduct =
    location.pathname === `/product/${encodeURIComponent(active.productId)}` ||
    location.pathname === `/product/${active.productId}`;
  const onDirect = location.pathname === "/control";
  const item = state.items.find((candidate) => candidate.id === active.itemId);
  const product = state.products.find((candidate) => candidate.id === active.productId);

  const setStage = (stage: SolutionWorkflowStage) => {
    setSolutionWorkflowStage(active.id, stage);
    setWorkflows(loadSolutionWorkflows());
  };

  const prepareArtifact = () => {
    if (!item || !product) return;
    const evidence = activeFinding
      ? [`${activeFinding.title} — ${activeFinding.detail}`]
      : item.description?.trim()
        ? [item.description.trim()]
        : [`Checklist item “${item.title}” is ${item.status.replace("_", " ")}.`];
    const signal: Signal = {
      id: `workflow:${active.id}`,
      level: item.type === "bug" ? "ACT_NOW" : "REVIEW",
      productId: product.id,
      productName: product.name,
      title: item.title,
      summary: item.description?.trim() || `Tracked solution work for ${product.name}.`,
      evidence,
      reasoning:
        "This artifact is prepared from the active ailhat solution workflow and its currently available evidence. Preparation does not claim execution or outcome verification.",
      recommendation: `Resolve “${item.title}” on ${product.name}, then verify the result with fresh evidence.`,
      action: `Use this prepared artifact to guide the implementation of “${item.title}”.`,
      priority: 500,
      recItems: [],
    };
    savePreparedWorkItem(
      buildSignalWorkItem(signal, item.type === "feature" ? "investigate" : "fix", Date.now(), product),
    );
    setStage("prepared");
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
        <div className="flex items-center gap-2">
          {activeWorkflows.length > 1 && (
            <select
              aria-label="Active solution workflow"
              value={active.id}
              onChange={(event) => setSelectedId(event.target.value)}
              className="max-w-[240px] rounded-lg border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-300"
            >
              {activeWorkflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.productName} · {workflow.itemTitle}
                </option>
              ))}
            </select>
          )}
          <span className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-gray-400">
            {active.stage}
          </span>
        </div>
      </div>

      <WorkflowRail stage={active.stage} />

      {active.stage === "verify" && !hasFreshVerificationScan && (
        <p className="mt-3 text-sm leading-6 text-amber-100/90">
          Implementation is marked done. Re-scan {active.productName}; only a successful scan newer than this verification request can move the workflow forward.
        </p>
      )}

      {active.stage === "verify" && hasFreshVerificationScan && !active.scanKey && (
        <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-sm leading-6 text-amber-100/90">
          Fresh scan evidence is available, but this issue is not measured by a specific scan rule. Review the relevant user path before explicitly confirming resolution.
        </div>
      )}

      {onDirect && (
        <p className="mt-3 text-sm leading-6 text-gray-300">
          Direct is continuing the linked issue above. A prepared artifact must exist before the workflow can claim preparation; preparation is still not execution or verification.
        </p>
      )}

      {onProduct && (
        <p className="mt-3 text-sm leading-6 text-gray-300">
          This Product Cockpit is the canonical context for the workflow. Its signals, checklist, scan history, findings, and prepared work are the same records carried through Today, Intelligence, and Direct.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!onProduct && !onDirect && (
          <Link
            to="/product/$productId"
            params={{ productId: active.productId }}
            className="silhat-btn silhat-btn-primary"
          >
            Open solution workflow →
          </Link>
        )}
        {onProduct && active.stage !== "verify" && rank[active.stage] < rank.prepared && (
          <Link
            to="/control"
            onClick={prepareArtifact}
            className="silhat-btn silhat-btn-primary"
          >
            Prepare in Direct →
          </Link>
        )}
        {onProduct && active.stage === "prepared" && (
          <Link to="/control" className="silhat-btn silhat-btn-primary">
            Open prepared work in Direct →
          </Link>
        )}
        {onDirect && active.stage === "prepared" && (
          <button
            type="button"
            onClick={() => setStage("implementation")}
            className="silhat-btn silhat-btn-ghost"
          >
            Direction handed off / implementing
          </button>
        )}
        {active.stage === "verify" && !hasFreshVerificationScan && (
          <Link
            to="/product/$productId"
            params={{ productId: active.productId }}
            className="silhat-btn silhat-btn-primary"
          >
            Re-scan in Product Cockpit →
          </Link>
        )}
        {active.stage === "verify" && hasFreshVerificationScan && !active.scanKey && (
          <button
            type="button"
            onClick={() => setStage("resolved")}
            className="silhat-btn silhat-btn-primary"
          >
            Confirm reviewed + resolved
          </button>
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
