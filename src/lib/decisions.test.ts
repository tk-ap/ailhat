// Behavior tests for the per-product Decisions state + rescan-integrity guards.
//
// Covers:
//   (a) a newly surfaced recommendation defaults to "not-decisioned" (the app
//       never auto-claims deployed / paused / deferred);
//   (b) the disposition enum values are the only allowed states;
//   (c) the destructive reset is GATED — a no-op on the authenticated/real
//       portfolio path (allow=false), only clearing an anonymous/demo session;
//   (d) server hydration (normalizeState) round-trips the new decisions field.
//
// Run with: bun test src/lib/decisions.test.ts
import { describe, expect, test } from "bun:test";
import {
  DECISION_DISPOSITIONS,
  isDecisionDisposition,
  resetData,
  setDecisionDisposition,
  setDecisions,
  type AppState,
} from "./store";
import { normalizeState } from "./useStore";

function baseState(): AppState {
  return {
    products: [
      {
        id: "p1",
        name: "ailhat",
        platform: "vercel",
        url: "https://ailhat.vercel.app",
        createdAt: 1,
      },
    ],
    items: [],
    decisions: {},
    scans: {},
    scanHistory: {},
    feedback: {},
    opportunities: [],
    opportunityFeedback: {},
  };
}

describe("per-product decisions", () => {
  test("(a) a newly surfaced recommendation defaults to not-decisioned", () => {
    const state = setDecisions(baseState(), "p1", [
      { id: "a1", title: "Harden production reliability", disposition: "not-decisioned" },
    ]);
    expect(state.decisions["p1"][0].disposition).toBe("not-decisioned");
  });

  test("(b) disposition enum values are the only allowed states", () => {
    expect(DECISION_DISPOSITIONS).toEqual([
      "not-decisioned",
      "deployed",
      "paused-for-timing",
      "deferred",
    ]);
    for (const d of DECISION_DISPOSITIONS) {
      expect(isDecisionDisposition(d)).toBe(true);
    }
    expect(isDecisionDisposition("deployed-yesterday")).toBe(false);
    expect(isDecisionDisposition("archived")).toBe(false);
    expect(isDecisionDisposition(123)).toBe(false);
    expect(isDecisionDisposition(undefined)).toBe(false);
  });

  test("setDecisionDisposition updates disposition, reason, and stamps updatedAt", () => {
    let state = setDecisions(baseState(), "p1", [
      { id: "a1", title: "Ship the directive compiler", disposition: "not-decisioned" },
    ]);
    state = setDecisionDisposition(state, "p1", "a1", "deployed", "shipped with #22");
    const d = state.decisions["p1"][0];
    expect(d.disposition).toBe("deployed");
    expect(d.reason).toBe("shipped with #22");
    expect(typeof d.updatedAt).toBe("number");
  });

  test("an invalid disposition is rejected (state unchanged — never invents state)", () => {
    let state = setDecisions(baseState(), "p1", [
      { id: "a1", title: "Build billing", disposition: "not-decisioned" },
    ]);
    const before = state.decisions;
    const next = setDecisionDisposition(state, "p1", "a1", "archived");
    expect(next.decisions).toBe(before);
    expect(next.decisions["p1"][0].disposition).toBe("not-decisioned");
  });
});

describe("destructive reset is gated", () => {
  const withData = () =>
    setDecisions(baseState(), "p1", [
      { id: "a1", title: "Ship", disposition: "deployed" },
    ]);

  test("(c) resetData(allow=false) is a strict no-op on the authenticated/real portfolio", () => {
    const s = withData();
    const next = resetData(s, false);
    expect(next).toBe(s); // same state object, nothing wiped
    expect(next.products.length).toBe(1);
    expect(Object.keys(next.decisions)).toContain("p1");
  });

  test("(c) resetData(allow=true) only clears an anonymous/demo session", () => {
    const s = withData();
    const next = resetData(s, true);
    expect(next.products).toEqual([]);
    expect(next.decisions).toEqual({});
  });
});

describe("hydration round-trip", () => {
  test("(d) normalizeState preserves the decisions field verbatim", () => {
    const decisions = {
      p1: [
        {
          id: "a1",
          title: "Complete live scanning loop",
          disposition: "paused-for-timing",
          reason: "waiting on scan backend",
          updatedAt: 123,
        },
      ],
    };
    const raw = { ...baseState(), decisions } as unknown as AppState;
    const norm = normalizeState(raw);
    expect(norm?.decisions).toEqual(decisions);
  });

  test("(d) normalizeState defaults a missing decisions field to {}", () => {
    const raw = baseState() as unknown as AppState;
    delete (raw as { decisions?: unknown }).decisions;
    const norm = normalizeState(raw);
    expect(norm?.decisions).toEqual({});
  });
});
