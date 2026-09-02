import { describe, expect, test } from "bun:test";
import type { Signal } from "./brief";
import { buildSignalWorkItem, compileSignalWorkItemMarkdown } from "./signal-work-item";

describe("Direct problem truthfulness", () => {
  test("does not turn absence of ailhat-visible completion into 'nothing completed'", () => {
    const signal: Signal = {
      id: "queue-review-ailhat",
      level: "REVIEW",
      title: "3 unresolved items on ailhat need a queue decision",
      summary: "Work is accumulating on ailhat with no recent completion — the queue is stalling.",
      evidence: ["3 unresolved items are recorded in ailhat."],
      reasoning: "The observed queue needs review.",
      recommendation: "Review the unresolved queue.",
      action: "Reconcile the current state.",
      priority: 453,
      recItems: [],
      inference: {
        kind: "inference",
        confidence: "MEDIUM",
        basis: [
          "3 unresolved items are recorded in ailhat.",
          "No recent completion is recorded in ailhat-visible state.",
        ],
        missingEvidence: [
          "Whether work completed outside ailhat's observed surfaces.",
        ],
      },
    };

    const item = buildSignalWorkItem(signal, "fix", Date.UTC(2026, 8, 2));
    expect(item.problem).toContain("Observed by ailhat");
    expect(item.problem).toContain("ailhat-visible evidence");
    expect(item.problem).toContain("outside ailhat");
    expect(item.problem).not.toContain("queue is stalling");
    expect(item.acceptanceCriteria.some((criterion) => criterion.includes("external execution/completion"))).toBe(true);

    const markdown = compileSignalWorkItemMarkdown(item);
    expect(markdown).toContain("does not establish that no work has occurred outside ailhat");
  });
});
