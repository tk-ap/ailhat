import { describe, expect, test } from "bun:test";
import { findingRelevance, applicableFindings, type ProductOperatingProfile } from "./product-profile";
import type { Product } from "./store";
import type { ScanFinding } from "./scanSite";

const product: Product = { id: "ledgato", name: "LEDGATo", platform: "vercel", url: "https://ledgato.vercel.app", createdAt: 1 };
const finding = (ruleId: string): ScanFinding => ({
  ruleId, severity: "MEDIUM", confidence: "HIGH", title: ruleId, detail: "observed", status: "fail", stableKey: ruleId,
});

describe("product operating profiles", () => {
  test("unknown profiles ask for review instead of silently suppressing conversion findings", () => {
    expect(findingRelevance(product, finding("ux-primary-cta")).status).toBe("needs_review");
    expect(applicableFindings(product, [finding("ux-primary-cta")])).toHaveLength(1);
  });

  test("a product with no conversion goal does not rank conversion heuristics", () => {
    const profile: ProductOperatingProfile = { kind: "service", primaryOutcome: "none" };
    const profiled = { ...product, profile };
    expect(findingRelevance(profiled, finding("conversion-path")).status).toBe("not_applicable");
    expect(applicableFindings(profiled, [finding("conversion-path"), finding("missing-robots")])).toHaveLength(1);
  });

  test("raw findings remain available to inspect even when a rule is not applicable", () => {
    const profile: ProductOperatingProfile = { kind: "api", primaryOutcome: "documentation" };
    expect(findingRelevance({ ...product, profile }, finding("ux-dead-end")).reason).toContain("does not describe");
  });
});
