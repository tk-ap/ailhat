export type WorkDisposition =
  | "act"
  | "defer"
  | "descope"
  | "supersede"
  | "already_fixed";

export type WorkLifecycleStage =
  | "observe"
  | "decide"
  | "direct"
  | "verify"
  | "retire";

export type VerificationResult =
  | "pending"
  | "resolved"
  | "persisting"
  | "regressed"
  | "unable_to_verify";

export type WorkTerminalOutcome =
  | "verified_done"
  | "descoped"
  | "superseded"
  | "unable_to_verify";

export interface WorkLifecycle {
  stage: WorkLifecycleStage;
  disposition?: WorkDisposition;
  sourceObservationIds: string[];
  executionEvidence: string[];
  verificationEvidence: string[];
  verificationResult: VerificationResult;
  terminalOutcome?: WorkTerminalOutcome;
  supersededBy?: string;
  lastTransitionAt: string;
}

export interface QueueStallEvidence {
  openCount: number;
  recentCompletionObserved: boolean;
  activeExecutionObserved: boolean;
  repeatedUnchangedObservationObserved: boolean;
  dispositionEvidenceObserved: boolean;
}

export type QueueStallAssessment =
  | { state: "not_suspected"; confidence: "HIGH"; reason: string }
  | {
      state: "suspected";
      confidence: "MEDIUM";
      reason: string;
      missingEvidence: string[];
    };

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function createObservedLifecycle(
  sourceObservationIds: string[],
  at = new Date().toISOString(),
): WorkLifecycle {
  return {
    stage: "observe",
    sourceObservationIds: unique(sourceObservationIds),
    executionEvidence: [],
    verificationEvidence: [],
    verificationResult: "pending",
    lastTransitionAt: at,
  };
}

export function decideWork(
  lifecycle: WorkLifecycle,
  disposition: WorkDisposition,
  at = new Date().toISOString(),
): WorkLifecycle {
  return {
    ...lifecycle,
    stage: "decide",
    disposition,
    lastTransitionAt: at,
  };
}

export function directWork(
  lifecycle: WorkLifecycle,
  executionEvidence: string[] = [],
  at = new Date().toISOString(),
): WorkLifecycle {
  return {
    ...lifecycle,
    stage: "direct",
    executionEvidence: unique([
      ...lifecycle.executionEvidence,
      ...executionEvidence,
    ]),
    lastTransitionAt: at,
  };
}

export function verifyWork(
  lifecycle: WorkLifecycle,
  result: Exclude<VerificationResult, "pending">,
  evidence: string[] = [],
  at = new Date().toISOString(),
): WorkLifecycle {
  return {
    ...lifecycle,
    stage: "verify",
    verificationResult: result,
    verificationEvidence: unique([
      ...lifecycle.verificationEvidence,
      ...evidence,
    ]),
    lastTransitionAt: at,
  };
}

export function retireWork(
  lifecycle: WorkLifecycle,
  outcome: WorkTerminalOutcome,
  at = new Date().toISOString(),
  supersededBy?: string,
): WorkLifecycle {
  if (outcome === "verified_done" && lifecycle.verificationResult !== "resolved") {
    throw new Error("verified_done requires a resolved verification result");
  }
  if (outcome === "superseded" && !supersededBy) {
    throw new Error("superseded work requires a supersededBy reference");
  }
  return {
    ...lifecycle,
    stage: "retire",
    terminalOutcome: outcome,
    supersededBy: outcome === "superseded" ? supersededBy : lifecycle.supersededBy,
    lastTransitionAt: at,
  };
}

export function canClaimExecutionStarted(lifecycle: WorkLifecycle): boolean {
  return lifecycle.executionEvidence.length > 0;
}

/**
 * Conservative stall inference.
 *
 * An open queue with no recorded completion is not enough to claim a stall.
 * We only call a stall "suspected" when the queue is large, no completion or
 * active execution is observed, and repeated observations show it unchanged.
 * Even then the result remains an inference until lifecycle/disposition evidence
 * rules out deliberate deferral, descope, supersession, or work completed elsewhere.
 */
export function assessQueueStall(
  evidence: QueueStallEvidence,
  threshold = 3,
): QueueStallAssessment {
  if (evidence.openCount < threshold) {
    return {
      state: "not_suspected",
      confidence: "HIGH",
      reason: `Only ${evidence.openCount} unresolved item(s) are recorded; below the ${threshold}-item review threshold.`,
    };
  }
  if (evidence.recentCompletionObserved) {
    return {
      state: "not_suspected",
      confidence: "HIGH",
      reason: "Recent completion evidence is recorded.",
    };
  }
  if (evidence.activeExecutionObserved) {
    return {
      state: "not_suspected",
      confidence: "HIGH",
      reason: "Active execution is recorded for at least one unresolved item.",
    };
  }
  if (!evidence.repeatedUnchangedObservationObserved) {
    return {
      state: "not_suspected",
      confidence: "HIGH",
      reason:
        "No recent completion is recorded, but ailhat has not observed the same queue unchanged across repeated observations; absence of completion alone is not stall evidence.",
    };
  }
  if (evidence.dispositionEvidenceObserved) {
    return {
      state: "not_suspected",
      confidence: "HIGH",
      reason:
        "The unresolved queue has explicit decision/disposition evidence, so inactivity should not be inferred solely from age.",
    };
  }
  return {
    state: "suspected",
    confidence: "MEDIUM",
    reason:
      "The unresolved queue remained unchanged across repeated observations, with no recent completion, active execution, or disposition evidence recorded.",
    missingEvidence: [
      "Whether work completed outside ailhat's observed surfaces.",
      "Whether any item was deliberately deferred, descoped, or superseded.",
      "Whether execution is active but not represented in ailhat.",
    ],
  };
}

export interface CompressedWorkPackage<T> {
  id: string;
  title: string;
  sources: T[];
  lifecycle: WorkLifecycle;
}

/** Preserve many observations as evidence while exposing one actionable package. */
export function compressObservations<T extends { id: string }>(
  id: string,
  title: string,
  sources: T[],
  at = new Date().toISOString(),
): CompressedWorkPackage<T> {
  return {
    id,
    title,
    sources,
    lifecycle: createObservedLifecycle(sources.map((source) => source.id), at),
  };
}
