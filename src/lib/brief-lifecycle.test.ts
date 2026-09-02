import { describe, expect, test } from "bun:test";
import { computeBrief } from "./brief";
import type { AppState, Item, Product } from "./store";

const DAY = 24 * 60 * 60 * 1000;

function product(): Product {
  return {
    id: "p1",
    name: "ailhat",
    platform: "vercel",
    url: "https://ailhat.vercel.app",
    createdAt: Date.now() - 30 * DAY,
  };
}

function item(id: string, status: Item["status"] = "open"): Item {
  return {
    id,
    productId: "p1",
    type: "issue",
    title: `Finding ${id}`,
    status,
    createdAt: Date.now() - 10 * DAY,
  };
}

function state(items: Item[]): AppState {
  return {
    products: [product()],
    items,
    scans: {},
    feedback: {},
    retiredProducts: [],
    decisions: {},
    scanHistory: {},
    productActivity: {},
    engagement: {},
    opportunities: [],
    opportunityFeedback: {},
  };
}

describe("Daily Brief queue inference", () => {
  test("open + no recent completion produces an evidence-qualified review, not ACT_NOW stalled", () => {
    const signals = computeBrief(state([
      item("1"),
      item("2"),
      item("3"),
      item("4"),
    ]));

    const queue = signals.find((signal) => signal.id === "queue-review-p1");
    expect(queue).toBeDefined();
    expect(queue?.level).toBe("REVIEW");
    expect(queue?.summary).toContain("not proof that shipping has stalled");
    expect(queue?.inference?.kind).toBe("inference");
    expect(queue?.inference?.missingEvidence?.length).toBeGreaterThan(0);
    expect(signals.some((signal) => signal.id === "stalled-p1")).toBe(false);
  });

  test("recorded in-progress work suppresses the possible-stall queue review", () => {
    const signals = computeBrief(state([
      item("1", "in_progress"),
      item("2"),
      item("3"),
      item("4"),
    ]));

    expect(signals.some((signal) => signal.id === "queue-review-p1")).toBe(false);
    expect(signals.some((signal) => signal.id === "review-open-p1")).toBe(true);
  });
});
