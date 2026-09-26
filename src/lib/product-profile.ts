import type { Product } from "./store";
import type { ScanFinding } from "./scanSite";

export type ProductKind = "saas" | "publication" | "api" | "internal-tool" | "service" | "portfolio" | "other";
export type PrimaryOutcome = "conversion" | "content" | "documentation" | "workflow" | "none" | "unknown";

export interface ProductOperatingProfile {
  kind: ProductKind;
  primaryOutcome: PrimaryOutcome;
  purpose?: string;
  audience?: string;
  notes?: string;
}

export type FindingApplicability = "relevant" | "not_applicable" | "needs_review" | "unknown";
export interface FindingRelevance { status: FindingApplicability; reason: string; }

const CONVERSION_RULES = new Set(["ux-primary-cta", "conversion-path", "conv-pricing-action", "ux-dead-end", "ux-trust-signals"]);
const DISCOVERY_RULES = new Set(["content-title", "content-thin", "missing-meta-description", "missing-og", "missing-robots", "missing-sitemap"]);

export function profileFor(product: Product): ProductOperatingProfile {
  return product.profile ?? { kind: "other", primaryOutcome: "unknown" };
}

export function findingRelevance(product: Product, finding: ScanFinding): FindingRelevance {
  const profile = profileFor(product);
  if (CONVERSION_RULES.has(finding.ruleId)) {
    if (profile.primaryOutcome === "none" || profile.kind === "api" || profile.kind === "internal-tool") {
      return { status: "not_applicable", reason: "This product profile does not describe a public conversion journey." };
    }
    if (profile.primaryOutcome === "unknown") {
      return { status: "needs_review", reason: "Ailhat observed a conversion heuristic, but the product’s intended primary action is not defined." };
    }
    return { status: "relevant", reason: "The product profile includes a public conversion or action journey." };
  }
  if (DISCOVERY_RULES.has(finding.ruleId) && profile.kind === "internal-tool") {
    return { status: "not_applicable", reason: "Internal tools are not automatically judged as public-discovery sites." };
  }
  if (profile.primaryOutcome === "unknown") return { status: "unknown", reason: "No product operating profile has been supplied yet." };
  return { status: "relevant", reason: "This observation is applicable to the supplied product profile." };
}

export function applicableFindings(product: Product, findings: ScanFinding[]): ScanFinding[] {
  return findings.filter((finding) => findingRelevance(product, finding).status !== "not_applicable");
}
