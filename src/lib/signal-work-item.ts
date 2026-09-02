import type { Signal } from "./brief";
import type { Product } from "./store";
import { recommendSkillsFor } from "./directiveSkills";
import type { SkillRef } from "./directiveSkills";
import {
  createObservedLifecycle,
  decideWork,
  type WorkLifecycle,
} from "./work-lifecycle";

export type SignalWorkMode = "fix" | "investigate";
export type SignalWorkStatus = "prepared";

export interface SignalWorkEvidence {
  fact: string;
  source: "ailhat-signal";
}

export interface SignalWorkItem {
  schema: "ailhat.signal-work-item/v2";
  id: string;
  mode: SignalWorkMode;
  status: SignalWorkStatus;
  generatedAt: string;
  signalId: string;
  sourceObservationIds: string[];
  lifecycle: WorkLifecycle;
  product: {
    id: string | null;
    name: string | null;
    url: string | null;
    platform: string | null;
  };
  title: string;
  problem: string;
  desiredOutcome: string;
  evidence: SignalWorkEvidence[];
  reasoning: string;
  recommendation: string;
  proposedAction: string;
  acceptanceCriteria: string[];
  investigation?: {
    question: string;
    known: string[];
    unknowns: string[];
    stopCondition: string;
    decisionUnlocked: string;
  };
  recommendedSkills: SkillRef[];
  execution: {
    state: "prepared";
    note: string;
  };
}

function productSnapshot(signal: Signal, product?: Product | null) {
  return {
    id: product?.id ?? signal.productId ?? null,
    name: product?.name ?? signal.productName ?? null,
    url: product?.url || null,
    platform: product?.platform ?? null,
  };
}

function sourceObservationIds(signal: Signal): string[] {
  const scanKeys = signal.recItems
    .map((item) => item.scanKey)
    .filter((key): key is string => Boolean(key));
  return scanKeys.length > 0 ? [...new Set(scanKeys)] : [signal.id];
}

/**
 * Inference-backed signals must describe the observed evidence, not promote an
 * inference into an authoritative statement about execution elsewhere.
 */
function scopedProblem(signal: Signal): string {
  if (!signal.inference) return signal.summary;

  const basis = signal.inference.basis.filter(Boolean).join(" ");
  return (
    `Observed by ailhat: ${basis || signal.summary} ` +
    "This is limited to ailhat-visible evidence. It does not establish that no related work was completed through GitHub, Vercel, another harness, another connected environment, or manual work outside ailhat."
  );
}

function fixAcceptanceCriteria(signal: Signal): string[] {
  const criteria = [
    `The condition described by “${signal.title}” is no longer reproducible.`,
    "The relevant user path works without introducing a new blocking regression.",
    "Re-run the supporting observation/scan when one exists and record the result.",
  ];

  if (signal.inference) {
    criteria.push(
      "Reconcile available external execution/completion evidence before concluding that work is still outstanding.",
      "If external completion evidence is unavailable, preserve that uncertainty instead of asserting that no work occurred outside ailhat.",
    );
  }

  if (signal.recItems.length > 0) {
    criteria.push(
      ...signal.recItems.slice(0, 3).map((item) => `Resolve and verify: ${item.title}.`),
    );
  }
  return criteria;
}

export function buildSignalWorkItem(
  signal: Signal,
  mode: SignalWorkMode,
  generatedAtMs: number,
  product?: Product | null,
): SignalWorkItem {
  const target = productSnapshot(signal, product);
  const generatedAt = new Date(generatedAtMs).toISOString();
  const observations = sourceObservationIds(signal);
  const observed = createObservedLifecycle(observations, generatedAt);
  // Preparing a fix is an explicit Act decision, but remains pre-execution.
  // Investigate stays at Observe until the premise is strong enough to decide.
  const lifecycle = mode === "fix" ? decideWork(observed, "act", generatedAt) : observed;
  const skillText = [
    signal.title,
    signal.summary,
    signal.recommendation,
    signal.action,
    ...signal.evidence,
  ].join(" ");

  const base: SignalWorkItem = {
    schema: "ailhat.signal-work-item/v2",
    id: `${signal.id}:${mode}`,
    mode,
    status: "prepared",
    generatedAt,
    signalId: signal.id,
    sourceObservationIds: observations,
    lifecycle,
    product: target,
    title: mode === "fix" ? `Fix: ${signal.title}` : `Investigate: ${signal.title}`,
    problem: scopedProblem(signal),
    desiredOutcome:
      mode === "fix"
        ? signal.recommendation
        : `Resolve whether the current signal is valid enough to support a product decision: ${signal.title}`,
    evidence: signal.evidence.map((fact) => ({ fact, source: "ailhat-signal" as const })),
    reasoning: signal.reasoning,
    recommendation: signal.recommendation,
    proposedAction: signal.action,
    acceptanceCriteria:
      mode === "fix"
        ? fixAcceptanceCriteria(signal)
        : [
            "Separate confirmed facts from assumptions.",
            "Collect enough evidence to support or reject the signal premise.",
            "Check for relevant execution/completion evidence outside ailhat when the connected environment can provide it.",
            "Return a recommended next decision with cited evidence and remaining uncertainty.",
          ],
    recommendedSkills: recommendSkillsFor(skillText),
    execution: {
      state: "prepared",
      note:
        "Prepared by ailhat for Direct / an agentic harness. This does not mean work has started, capacity is reserved, or the outcome has been completed. It also does not establish that no work has occurred outside ailhat; external execution must be observed or reconciled before ailhat makes that claim.",
    },
  };

  if (mode === "investigate") {
    base.investigation = {
      question: `Is the premise behind “${signal.title}” still true, material, and actionable?`,
      known: signal.evidence,
      unknowns: [
        "Whether the observed condition still reproduces now.",
        "Whether related execution or completion occurred outside ailhat's currently observed surfaces.",
        "Whether the condition materially affects the intended user or business outcome.",
        "Whether a lower-risk or higher-leverage response exists than the current recommendation.",
      ],
      stopCondition:
        "Stop when the premise can be confirmed or rejected with enough evidence to choose a next action without materially important unknowns being hidden.",
      decisionUnlocked:
        "Act, defer, descope, supersede, or mark already fixed with a documented reason; verify before retiring work as done.",
    };
  }

  return base;
}

export function compileSignalWorkItemMarkdown(item: SignalWorkItem): string {
  const product = item.product.name ?? "Portfolio-level signal";
  const disposition = item.lifecycle.disposition ?? "undecided";
  const lines = [
    `# ${item.title}`,
    "",
    `**Status:** prepared · not executed`,
    `**Product:** ${product}${item.product.url ? ` · ${item.product.url}` : ""}`,
    `**Signal:** ${item.signalId}`,
    `**Generated:** ${item.generatedAt}`,
    "",
    "## Lifecycle",
    `**Stage:** ${item.lifecycle.stage}`,
    `**Disposition:** ${disposition}`,
    `**Verification:** ${item.lifecycle.verificationResult}`,
    `**Source observations:** ${item.sourceObservationIds.length}`,
    "",
    "A decision to Act is not execution evidence. Work may only be represented as started when execution evidence exists, and only retired as done after verification resolves the original condition.",
    "",
    "## Problem",
    item.problem,
    "",
    "## Desired outcome",
    item.desiredOutcome,
    "",
    "## Evidence",
    ...item.evidence.map((e) => `- ${e.fact}`),
    "",
    "## Reasoning",
    item.reasoning,
    "",
    "## Proposed action",
    item.proposedAction,
    "",
    "## Acceptance criteria",
    ...item.acceptanceCriteria.map((criterion) => `- ${criterion}`),
  ];

  if (item.investigation) {
    lines.push(
      "",
      "## Investigation boundary",
      `**Question:** ${item.investigation.question}`,
      "",
      "**Unknowns to verify:**",
      ...item.investigation.unknowns.map((unknown) => `- ${unknown}`),
      "",
      `**Stop condition:** ${item.investigation.stopCondition}`,
      `**Decision unlocked:** ${item.investigation.decisionUnlocked}`,
    );
  }

  if (item.recommendedSkills.length > 0) {
    lines.push(
      "",
      "## Optional skills",
      ...item.recommendedSkills.map((skill) => `- ${skill.name} — ${skill.why} — ${skill.url}`),
    );
  }

  lines.push(
    "",
    "## Execution honesty",
    item.execution.note,
    "",
  );
  return lines.join("\n");
}

export function compileSignalWorkItemJson(item: SignalWorkItem): string {
  return JSON.stringify(item, null, 2);
}
