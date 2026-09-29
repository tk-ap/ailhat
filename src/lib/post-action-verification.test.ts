import { describe, expect, test } from "bun:test";
import type { Product } from "./store";
import type { ProductVerificationSnapshot } from "./post-action-verification";
import { compareProductVerification } from "./post-action-verification";

const product: Product = {
  id: "ledgato",
  name: "ledgato",
  platform: "vercel",
  url: "https://ledgato.vercel.app",
  repository: "tk-ap/ledgato",
  createdAt: 1,
  profile: {
    kind: "api",
    primaryOutcome: "workflow",
    purpose: "Enforce consequential agent actions.",
    audience: "Agent operators.",
    primaryJourney: "Understand boundary → act → inspect proof.",
    relevantSurfaces: ["landing", "docs", "api", "status"],
    nonGoals: ["SaaS pricing"],
  },
};

function snap(checks: ProductVerificationSnapshot["checks"], reachable = true): ProductVerificationSnapshot {
  return {
    target: "sandbox",
    url: "https://ledgato-test.here.now",
    scannedAt: 1,
    reachable,
    checks,
  };
}

describe("post-action product verification", () => {
  test("reports improved only from observed fail -> ok evidence", () => {
    const result = compareProductVerification(
      product,
      snap([{ stableKey: "missing-og", ruleId: "missing-og", severity: "LOW", status: "fail" }]),
      snap([{ stableKey: "missing-og", ruleId: "missing-og", severity: "LOW", status: "ok" }]),
      new Date("2026-09-29T12:00:00Z"),
    );
    expect(result.verdict).toBe("IMPROVED");
    expect(result.resolved).toEqual(["missing-og"]);
    expect(result.regressed).toEqual([]);
  });

  test("reports regressed when an applicable passing check becomes failing", () => {
    const result = compareProductVerification(
      product,
      snap([{ stableKey: "missing-og", ruleId: "missing-og", severity: "LOW", status: "ok" }]),
      snap([{ stableKey: "missing-og", ruleId: "missing-og", severity: "LOW", status: "fail" }]),
    );
    expect(result.verdict).toBe("REGRESSED");
    expect(result.regressed).toEqual(["missing-og"]);
  });

  test("does not count declared non-goal pricing heuristics as product regression", () => {
    const result = compareProductVerification(
      product,
      snap([{ stableKey: "conv-pricing-action", ruleId: "conv-pricing-action", severity: "HIGH", status: "ok" }]),
      snap([{ stableKey: "conv-pricing-action", ruleId: "conv-pricing-action", severity: "HIGH", status: "fail" }]),
    );
    expect(result.verdict).toBe("UNCHANGED");
    expect(result.regressed).toEqual([]);
    expect(result.ignoredNotApplicable).toEqual(["conv-pricing-action"]);
  });

  test("does not infer resolution when the after scan lacks the prior check", () => {
    const result = compareProductVerification(
      product,
      snap([{ stableKey: "missing-og", ruleId: "missing-og", severity: "LOW", status: "fail" }]),
      snap([]),
    );
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
    expect(result.resolved).toEqual([]);
    expect(result.uncertain).toEqual(["missing-og"]);
  });

  test("reports regression when the sandbox was reachable before but not after", () => {
    const result = compareProductVerification(product, snap([]), snap([], false));
    expect(result.verdict).toBe("REGRESSED");
  });

  test("requires a baseline before claiming improvement", () => {
    const result = compareProductVerification(product, null, snap([]));
    expect(result.verdict).toBe("INSUFFICIENT_EVIDENCE");
  });
});
