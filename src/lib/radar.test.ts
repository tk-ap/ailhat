import { describe, expect, test } from "bun:test";
import { effectiveRadarDisposition, normalizeRadarDraft, recommendRadarSignal, scoreRadarSignal } from "./radar";

describe("RADAR v2", () => {
  test("normalizes provenance and computes triage without owner override", () => {
    const signal = normalizeRadarDraft({
      inputMode: "url",
      source: " IdeaBrowser ",
      sourceUrl: " https://example.com/signal ",
      signalType: "opportunity",
      problem: " Fragmented portfolio decisions ",
      audience: " Multi-product founders ",
      evidence: "Repeated founder complaint\nCategory growth",
      marketMomentum: 4,
      portfolioAdjacency: 5,
      founderFit: 4,
      existingLeverage: 5,
      executionCost: 2,
      strategicRisk: 1,
    }, 1234);
    expect(signal.source).toBe("IdeaBrowser");
    expect(signal.evidence).toEqual(["Repeated founder complaint", "Category growth"]);
    expect(signal.computedDisposition).toBe("ABSORB");
    expect(signal.ownerDisposition).toBeUndefined();
    expect(effectiveRadarDisposition(signal)).toBe("ABSORB");
  });

  test("owner disposition is separate from computed recommendation", () => {
    const signal = normalizeRadarDraft({
      inputMode: "manual", source: "Founder note", signalType: "trend", problem: "New category", audience: "Builders", evidence: "One observation",
      marketMomentum: 4, portfolioAdjacency: 4, founderFit: 4, existingLeverage: 4, executionCost: 2, strategicRisk: 1,
    }, 1000);
    const overridden = { ...signal, ownerDisposition: "WATCH" as const };
    expect(overridden.computedDisposition).not.toBe("WATCH");
    expect(effectiveRadarDisposition(overridden)).toBe("WATCH");
  });

  test("high risk low leverage rejects", () => {
    expect(recommendRadarSignal({ marketMomentum: 3, portfolioAdjacency: 2, founderFit: 2, existingLeverage: 1, executionCost: 4, strategicRisk: 5 })).toBe("REJECT");
  });

  test("score is bounded", () => {
    expect(scoreRadarSignal({ marketMomentum: 9, portfolioAdjacency: 9, founderFit: 9, existingLeverage: 9, executionCost: -2, strategicRisk: -2 })).toBe(100);
  });
});
