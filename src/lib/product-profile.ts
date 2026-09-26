import type { Product } from "./store";
import type { ScanFinding } from "./scanSite";

export type ProductKind = "saas" | "publication" | "api" | "internal-tool" | "service" | "portfolio" | "other";
export type PrimaryOutcome = "conversion" | "content" | "documentation" | "workflow" | "none" | "unknown";

export const PRODUCT_SURFACES = [
  "landing",
  "signup",
  "pricing",
  "docs",
  "api",
  "status",
  "dashboard",
  "auth",
  "contact",
  "portfolio",
  "other",
] as const;
export type ProductSurface = (typeof PRODUCT_SURFACES)[number];

export const PRODUCT_SURFACE_LABELS: Record<ProductSurface, string> = {
  landing: "Public landing",
  signup: "Signup / onboarding",
  pricing: "Pricing",
  docs: "Docs",
  api: "API",
  status: "Status / proof",
  dashboard: "Dashboard / workspace",
  auth: "Authentication",
  contact: "Contact / request access",
  portfolio: "Portfolio / content",
  other: "Other",
};

export interface ProductOperatingProfile {
  kind: ProductKind;
  primaryOutcome: PrimaryOutcome;
  purpose?: string;
  audience?: string;
  primaryJourney?: string;
  relevantSurfaces?: ProductSurface[];
  nonGoals?: string[];
  notes?: string;
}

export interface ResolvedProductOperatingProfile extends ProductOperatingProfile {
  relevantSurfaces: ProductSurface[];
  nonGoals: string[];
}

export type FindingApplicability = "relevant" | "not_applicable" | "needs_review" | "unknown";
export interface FindingRelevance {
  status: FindingApplicability;
  reason: string;
}

const PRIMARY_ACTION_RULES = new Set([
  "ux-primary-cta",
  "ux-dead-end",
  "ux-form-submit",
  "conv-path",
  "conv-trust",
]);
const PRICING_RULES = new Set(["conv-pricing-action"]);
const DISCOVERY_RULES = new Set([
  "content-title",
  "content-thin",
  "missing-meta-description",
  "short-description",
  "missing-og",
  "missing-favicon",
  "missing-robots",
  "missing-sitemap",
]);

const LEDGATO_DEFAULT: ResolvedProductOperatingProfile = {
  kind: "api",
  primaryOutcome: "workflow",
  purpose: "Define, enforce, and verify delegated authority boundaries for autonomous agents.",
  audience: "AI power users, builders, and operators who need autonomous work without authority drift.",
  primaryJourney: "Understand the boundary → define authority → let the agent act → inspect evidence and verify enforcement.",
  relevantSurfaces: ["landing", "docs", "api", "dashboard", "auth", "status"],
  nonGoals: [
    "SaaS-style pricing as a prerequisite for product usefulness",
    "Requiring the web dashboard to stay open while enforcement runs",
  ],
};

const ASHWOOD_DEFAULT: ResolvedProductOperatingProfile = {
  kind: "portfolio",
  primaryOutcome: "workflow",
  purpose: "Serve as a public portfolio and build journal plus the authenticated owner workspace for directing ongoing work.",
  audience: "Visitors evaluating TK's work and the authenticated owner operating the workspace.",
  primaryJourney: "A visitor understands the work; the owner signs in to review evidence, direct work, and verify progress.",
  relevantSurfaces: ["landing", "dashboard", "auth", "portfolio"],
  nonGoals: [
    "SaaS-style pricing",
    "Public self-serve signup as a conversion requirement",
  ],
};

export function emptyOperatingProfile(): ResolvedProductOperatingProfile {
  return {
    kind: "other",
    primaryOutcome: "unknown",
    purpose: "",
    audience: "",
    primaryJourney: "",
    relevantSurfaces: [],
    nonGoals: [],
    notes: "",
  };
}

function cloneProfile(profile: ResolvedProductOperatingProfile): ResolvedProductOperatingProfile {
  return {
    ...profile,
    relevantSurfaces: [...profile.relevantSurfaces],
    nonGoals: [...profile.nonGoals],
  };
}

function inferredProfileFor(product: Product): ResolvedProductOperatingProfile | null {
  const identity = [product.name, product.url, product.repository].filter(Boolean).join(" ").toLowerCase();
  if (identity.includes("ledgato")) return cloneProfile(LEDGATO_DEFAULT);
  if (identity.includes("ashwood")) return cloneProfile(ASHWOOD_DEFAULT);
  return null;
}

export function profileFor(product: Product): ResolvedProductOperatingProfile {
  const inferred = inferredProfileFor(product);
  const raw = product.profile;
  if (!raw) return inferred ?? emptyOperatingProfile();

  const fallback = inferred ?? emptyOperatingProfile();
  return {
    ...fallback,
    ...raw,
    purpose: raw.purpose ?? fallback.purpose,
    audience: raw.audience ?? fallback.audience,
    primaryJourney: raw.primaryJourney ?? fallback.primaryJourney,
    notes: raw.notes ?? fallback.notes,
    relevantSurfaces: [...(raw.relevantSurfaces ?? fallback.relevantSurfaces)],
    nonGoals: [...(raw.nonGoals ?? fallback.nonGoals)],
  };
}

function hasSurface(profile: ResolvedProductOperatingProfile, surface: ProductSurface): boolean {
  return profile.relevantSurfaces.includes(surface);
}

function commercialJourneyKnown(profile: ResolvedProductOperatingProfile): boolean {
  return (
    profile.primaryOutcome === "conversion" ||
    hasSurface(profile, "signup") ||
    hasSurface(profile, "pricing") ||
    hasSurface(profile, "contact")
  );
}

function publicDiscoveryKnown(profile: ResolvedProductOperatingProfile): boolean {
  return (
    hasSurface(profile, "landing") ||
    hasSurface(profile, "docs") ||
    hasSurface(profile, "portfolio") ||
    profile.kind === "publication" ||
    profile.kind === "portfolio" ||
    profile.kind === "saas" ||
    profile.kind === "service"
  );
}

function journeyIsUnknown(profile: ResolvedProductOperatingProfile): boolean {
  return profile.primaryOutcome === "unknown" && profile.relevantSurfaces.length === 0;
}

export function findingRelevance(product: Product, finding: ScanFinding): FindingRelevance {
  const profile = profileFor(product);

  if (PRICING_RULES.has(finding.ruleId)) {
    if (journeyIsUnknown(profile)) {
      return {
        status: "needs_review",
        reason: "Ailhat observed a pricing heuristic, but the product profile does not yet say whether pricing is a relevant surface.",
      };
    }
    if (hasSurface(profile, "pricing")) {
      return { status: "relevant", reason: "Pricing is an explicit product surface." };
    }
    return {
      status: "not_applicable",
      reason: "Pricing is not part of this product's declared operating surfaces.",
    };
  }

  if (PRIMARY_ACTION_RULES.has(finding.ruleId)) {
    if (journeyIsUnknown(profile)) {
      return {
        status: "needs_review",
        reason: "Ailhat observed a conversion or primary-action heuristic, but the intended journey is not defined yet.",
      };
    }
    if (commercialJourneyKnown(profile)) {
      return {
        status: "relevant",
        reason: "The product profile includes a public conversion or contact journey.",
      };
    }
    return {
      status: "not_applicable",
      reason: "The declared primary journey is not a SaaS-style signup, pricing, or contact conversion funnel.",
    };
  }

  if (DISCOVERY_RULES.has(finding.ruleId)) {
    if (journeyIsUnknown(profile)) {
      return {
        status: "unknown",
        reason: "No product operating profile has been supplied yet, so discovery relevance remains unknown.",
      };
    }
    if (!publicDiscoveryKnown(profile)) {
      return {
        status: "not_applicable",
        reason: "The product profile does not declare a public discovery surface.",
      };
    }
    return {
      status: "relevant",
      reason: "The product profile includes a public discovery surface.",
    };
  }

  if (journeyIsUnknown(profile)) {
    return {
      status: "unknown",
      reason: "No product operating profile has been supplied yet. The finding stays in attention until context is clarified.",
    };
  }

  return {
    status: "relevant",
    reason: "This observation applies independently of the declared conversion journey.",
  };
}

export function classifyFindings(
  product: Product,
  findings: ScanFinding[],
): Array<{ finding: ScanFinding; applicability: FindingRelevance }> {
  return findings.map((finding) => ({
    finding,
    applicability: findingRelevance(product, finding),
  }));
}

export function applicableFindings(product: Product, findings: ScanFinding[]): ScanFinding[] {
  return findings.filter((finding) => findingRelevance(product, finding).status !== "not_applicable");
}
