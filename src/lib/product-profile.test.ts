import { describe, expect, test } from "bun:test";
import { computeAttention } from "./attention";
import { computeOpportunities } from "./opportunity";
import {
  applicableFindings,
  findingRelevance,
  profileFor,
  type ProductOperatingProfile,
} from "./product-profile";
import type { ScanFinding, ScanResult } from "./scanSite";
import type { AppState, Product } from "./store";
import { tenantPortfolioToWorkspaces } from "./tenant-control";

const ledgato: Product = {
  id: "ledgato",
  name: "LEDGATo",
  platform: "vercel",
  url: "https://ledgato.vercel.app",
  createdAt: 1,
};
const ashwood: Product = {
  id: "ashwood",
  name: "ASHWOOD",
  platform: "vercel",
  url: "https://ashwood-info.vercel.app",
  createdAt: 1,
};

const finding = (
  ruleId: string,
  severity: ScanFinding["severity"] = "MEDIUM",
): ScanFinding => ({
  ruleId,
  severity,
  confidence: "HIGH",
  title: ruleId,
  detail: "observed",
  status: "fail",
  stableKey: ruleId,
});

function scan(findings: ScanFinding[]): ScanResult {
  return {
    url: "https://example.com",
    requestedUrl: "https://example.com",
    ok: true,
    scannedAt: 5_000,
    findings,
  };
}

function state(product: Product, findings: ScanFinding[]): AppState {
  const result = scan(findings);
  return {
    products: [product],
    retiredProducts: [],
    items: [],
    decisions: {},
    scans: { [product.id]: result },
    scanHistory: {
      [product.id]: {
        lastGood: result,
        lastAttempt: result,
        consecutiveFailures: 0,
        snapshots: [],
        issues: {},
      },
    },
    productActivity: {},
    engagement: {},
    feedback: {},
    opportunities: [],
    opportunityFeedback: {},
  };
}

describe("product operating profiles", () => {
  test("supplies safe, product-specific defaults for LEDGATo and ASHWOOD", () => {
    const ledgatoProfile = profileFor(ledgato);
    const ashwoodProfile = profileFor(ashwood);
    expect(ledgatoProfile.kind).toBe("api");
    expect(ledgatoProfile.primaryOutcome).toBe("workflow");
    expect(ledgatoProfile.relevantSurfaces).toContain("api");
    expect(ledgatoProfile.relevantSurfaces).not.toContain("pricing");
    expect(ashwoodProfile.kind).toBe("portfolio");
    expect(ashwoodProfile.relevantSurfaces).toContain("portfolio");
    expect(ashwoodProfile.relevantSurfaces).not.toContain("signup");
    expect(ashwoodProfile.nonGoals.join(" ")).toContain("pricing");
  });

  test("unknown profiles ask for review instead of silently suppressing conversion findings", () => {
    const product: Product = {
      id: "unknown",
      name: "Unknown",
      platform: "other",
      url: "https://unknown.example",
      createdAt: 1,
    };
    expect(findingRelevance(product, finding("ux-primary-cta")).status).toBe("needs_review");
    expect(findingRelevance(product, finding("broken-links")).status).toBe("unknown");
    expect(applicableFindings(product, [finding("ux-primary-cta"), finding("broken-links")])).toHaveLength(2);
  });

  test("LEDGATo and ASHWOOD do not inherit SaaS conversion blockers", () => {
    expect(findingRelevance(ledgato, finding("conv-pricing-action")).status).toBe("not_applicable");
    expect(findingRelevance(ledgato, finding("conv-path")).status).toBe("not_applicable");
    expect(findingRelevance(ledgato, finding("broken-links")).status).toBe("relevant");
    expect(findingRelevance(ashwood, finding("ux-primary-cta")).status).toBe("not_applicable");
    expect(findingRelevance(ashwood, finding("conv-pricing-action")).status).toBe("not_applicable");
    expect(findingRelevance(ashwood, finding("missing-og")).status).toBe("relevant");
  });

  test("an explicitly commercial profile keeps commercial findings relevant", () => {
    const profile: ProductOperatingProfile = {
      kind: "saas",
      primaryOutcome: "conversion",
      relevantSurfaces: ["landing", "signup", "pricing"],
    };
    const product = { ...ledgato, id: "commercial", name: "Commercial", profile };
    expect(findingRelevance(product, finding("conv-path")).status).toBe("relevant");
    expect(findingRelevance(product, finding("conv-pricing-action")).status).toBe("relevant");
  });

  test("raw findings remain unchanged and inspectable when applicability filters ranking", () => {
    const raw = [finding("conv-pricing-action"), finding("broken-links")];
    const before = JSON.parse(JSON.stringify(raw));
    const filtered = applicableFindings(ledgato, raw);
    expect(raw).toEqual(before);
    expect(filtered.map((entry) => entry.ruleId)).toEqual(["broken-links"]);
  });

  test("ranking and generated opportunities exclude non-applicable findings but keep relevant evidence", () => {
    const current = state(ledgato, [
      finding("conv-pricing-action", "HIGH"),
      finding("broken-links", "HIGH"),
    ]);
    const attention = computeAttention(current).filter((item) => item.productId === ledgato.id);
    expect(attention.some((item) => item.finding?.ruleId === "conv-pricing-action")).toBe(false);
    expect(attention.some((item) => item.finding?.ruleId === "broken-links")).toBe(true);
    expect(computeOpportunities(current).some((item) => item.type === "CONVERSION")).toBe(false);
  });

  test("readiness counts context-aware failures instead of raw non-applicable conversion findings", () => {
    const current = state(ledgato, [
      finding("conv-pricing-action", "HIGH"),
      finding("broken-links", "HIGH"),
    ]);
    const workspace = tenantPortfolioToWorkspaces(current, 6_000)[0];
    expect(workspace.readinessAssessment.blockerCount).toBe(1);
  });
});
