import { describe, expect, test } from "bun:test";
import { normalizeExternalSignal, recommendSignal } from "./external-signal";

describe("RADAR external signals", () => {
  test("normalizes a captured signal into the v1 schema", () => {
    const signal = normalizeExternalSignal({
      input_mode: "url",
      source: " https://example.com/opportunity ",
      signal_type: "opportunity",
      problem: " Fragmented portfolio decisions ",
      audience: " Multi-product founders ",
      evidence: "Repeated founder complaint\nGrowing category",
      market_momentum: 4,
      portfolio_adjacency: 5,
      founder_fit: 4,
      existing_leverage: 5,
      execution_cost: 2,
      strategic_risk: 1,
    }, 1234);

    expect(signal.source).toBe("https://example.com/opportunity");
    expect(signal.evidence).toEqual(["Repeated founder complaint", "Growing category"]);
    expect(signal.recommendation).toBe("ABSORB");
    expect(signal.status).toBe("triaged");
    expect(signal.captured_at).toBe(1234);
  });

  test("rejects high-risk low-leverage signals", () => {
    expect(recommendSignal({
      market_momentum: 2,
      portfolio_adjacency: 1,
      founder_fit: 1,
      existing_leverage: 0,
      execution_cost: 5,
      strategic_risk: 5,
    }).recommendation).toBe("REJECT");
  });
});
