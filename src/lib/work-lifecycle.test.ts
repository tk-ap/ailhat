import { describe, expect, test } from "bun:test";
import {
  assessQueueStall,
  canClaimExecutionStarted,
  compressObservations,
  createObservedLifecycle,
  decideWork,
  directWork,
  retireWork,
  verifyWork,
} from "./work-lifecycle";

describe("evidence-aware work lifecycle", () => {
  test("preserves many observations behind one work package", () => {
    const pkg = compressObservations(
      "accessibility",
      "Accessibility semantics",
      [{ id: "buttons" }, { id: "labels" }, { id: "headings" }],
      "2026-09-02T00:00:00.000Z",
    );

    expect(pkg.sources).toHaveLength(3);
    expect(pkg.lifecycle.sourceObservationIds).toEqual([
      "buttons",
      "labels",
      "headings",
    ]);
    expect(pkg.lifecycle.stage).toBe("observe");
  });

  test("an Act decision does not imply execution started", () => {
    const observed = createObservedLifecycle(["finding-1"]);
    const decided = decideWork(observed, "act");

    expect(decided.stage).toBe("decide");
    expect(decided.disposition).toBe("act");
    expect(canClaimExecutionStarted(decided)).toBe(false);

    const directedWithoutEvidence = directWork(decided);
    expect(directedWithoutEvidence.stage).toBe("direct");
    expect(canClaimExecutionStarted(directedWithoutEvidence)).toBe(false);

    const directedWithEvidence = directWork(decided, ["PR #123 opened"]);
    expect(canClaimExecutionStarted(directedWithEvidence)).toBe(true);
  });

  test("verified completion requires resolved verification", () => {
    const observed = createObservedLifecycle(["finding-1"]);
    const decided = decideWork(observed, "act");

    expect(() => retireWork(decided, "verified_done")).toThrow();

    const verified = verifyWork(decided, "resolved", ["rescan passed"]);
    const retired = retireWork(verified, "verified_done");
    expect(retired.stage).toBe("retire");
    expect(retired.terminalOutcome).toBe("verified_done");
  });
});

describe("queue stall inference", () => {
  test("does not infer a stall from open + no completion alone", () => {
    const assessment = assessQueueStall({
      openCount: 8,
      recentCompletionObserved: false,
      activeExecutionObserved: false,
      repeatedUnchangedObservationObserved: false,
      dispositionEvidenceObserved: false,
    });

    expect(assessment.state).toBe("not_suspected");
    expect(assessment.reason).toContain("absence of completion alone");
  });

  test("does not infer a stall when active execution is observed", () => {
    const assessment = assessQueueStall({
      openCount: 8,
      recentCompletionObserved: false,
      activeExecutionObserved: true,
      repeatedUnchangedObservationObserved: true,
      dispositionEvidenceObserved: false,
    });

    expect(assessment.state).toBe("not_suspected");
  });

  test("only calls an unchanged undecisioned queue a suspected stall", () => {
    const assessment = assessQueueStall({
      openCount: 8,
      recentCompletionObserved: false,
      activeExecutionObserved: false,
      repeatedUnchangedObservationObserved: true,
      dispositionEvidenceObserved: false,
    });

    expect(assessment.state).toBe("suspected");
    if (assessment.state === "suspected") {
      expect(assessment.confidence).toBe("MEDIUM");
      expect(assessment.missingEvidence.length).toBeGreaterThan(0);
    }
  });
});
