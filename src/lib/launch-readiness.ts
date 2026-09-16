import type { ScanEvidence } from "./observations";

export type ReadinessDimensionStatus = "verified" | "failing" | "unknown";
export type ReadinessConfidence = "High" | "Medium" | "Low";

export interface LaunchReadinessDimension {
  id:
    | "runtime"
    | "technical-integrity"
    | "public-quality"
    | "recorded-blockers"
    | "https-boundary"
    | "conversion-path"
    | "auth-account"
    | "mobile-responsive"
    | "measurement"
    | "first-user-journey";
  label: string;
  weight: number;
  status: ReadinessDimensionStatus;
  source: string;
  detail: string;
}

export interface LaunchReadinessAssessment {
  score: number | null;
  coverage: number;
  confidence: ReadinessConfidence | null;
  verifiedCount: number;
  failingCount: number;
  unknownCount: number;
  blockerCount: number;
  freshnessHours: number | null;
  dimensions: LaunchReadinessDimension[];
  reason: string;
}

export interface LaunchReadinessInput {
  productUrl: string | null;
  highBlockerCount: number;
  scan: ScanEvidence | null;
}

/**
 * A readiness percentage is only emitted once enough weighted launch evidence is
 * actually observed. Unknown evidence is excluded from the score denominator and
 * remains visible as coverage debt; it is never silently counted as a failure.
 */
export const MIN_READINESS_COVERAGE = 60;

function httpsDimension(productUrl: string | null): LaunchReadinessDimension {
  if (!productUrl) {
    return {
      id: "https-boundary",
      label: "Production URL / TLS",
      weight: 10,
      status: "unknown",
      source: "portfolio product record",
      detail: "No production URL is recorded, so the production boundary cannot be verified.",
    };
  }
  try {
    const url = new URL(productUrl);
    if (url.protocol === "https:") {
      return {
        id: "https-boundary",
        label: "Production URL / TLS",
        weight: 10,
        status: "verified",
        source: "portfolio product record",
        detail: `Production URL uses HTTPS (${url.hostname}).`,
      };
    }
    return {
      id: "https-boundary",
      label: "Production URL / TLS",
      weight: 10,
      status: "failing",
      source: "portfolio product record",
      detail: `Production URL uses ${url.protocol || "a non-HTTPS scheme"}; HTTPS is not established by this evidence.`,
    };
  } catch {
    return {
      id: "https-boundary",
      label: "Production URL / TLS",
      weight: 10,
      status: "unknown",
      source: "portfolio product record",
      detail: "The recorded production URL is not parseable, so the production boundary remains unknown.",
    };
  }
}

function scanDimensions(scan: ScanEvidence | null): LaunchReadinessDimension[] {
  if (!scan) {
    return [
      {
        id: "runtime",
        label: "Runtime reachability",
        weight: 20,
        status: "unknown",
        source: "production site scan",
        detail: "No production scan has been recorded.",
      },
      {
        id: "technical-integrity",
        label: "Technical integrity",
        weight: 20,
        status: "unknown",
        source: "production site scan",
        detail: "Critical/high site failures have not been assessed.",
      },
      {
        id: "public-quality",
        label: "Public launch quality",
        weight: 10,
        status: "unknown",
        source: "production site scan",
        detail: "Public-page quality checks have not been assessed.",
      },
    ];
  }

  const severe = scan.findings.CRITICAL + scan.findings.HIGH;
  const medium = scan.findings.MEDIUM;
  const low = scan.findings.LOW;

  return [
    {
      id: "runtime",
      label: "Runtime reachability",
      weight: 20,
      status: scan.ok ? "verified" : "failing",
      source: "production site scan",
      detail: scan.ok
        ? "The production URL responded to the latest scan."
        : "The latest production scan could not verify the site as reachable.",
    },
    {
      id: "technical-integrity",
      label: "Technical integrity",
      weight: 20,
      status: severe > 0 ? "failing" : scan.ok ? "verified" : "unknown",
      source: "production site scan",
      detail:
        severe > 0
          ? `${severe} critical/high failing check${severe === 1 ? "" : "s"} observed.`
          : scan.ok
            ? "No critical/high failing checks were observed in the latest scan."
            : "The site was not reachable enough to establish technical integrity.",
    },
    {
      id: "public-quality",
      label: "Public launch quality",
      weight: 10,
      status: !scan.ok ? "unknown" : medium > 0 ? "failing" : "verified",
      source: "production site scan",
      detail: !scan.ok
        ? "The site was not reachable enough to assess public-page quality."
        : medium > 0
          ? `${medium} medium-severity launch-quality finding${medium === 1 ? "" : "s"} observed${low > 0 ? `; ${low} low-severity finding${low === 1 ? "" : "s"} also remain` : ""}.`
          : low > 0
            ? `No medium-or-higher launch-quality failure was observed; ${low} low-severity finding${low === 1 ? "" : "s"} remain inspectable.`
            : "No medium/low launch-quality failures were observed in the latest scan.",
    },
  ];
}

function unknownDimension(
  id: LaunchReadinessDimension["id"],
  label: string,
  weight: number,
  detail: string,
): LaunchReadinessDimension {
  return {
    id,
    label,
    weight,
    status: "unknown",
    source: "not yet instrumented",
    detail,
  };
}

export function assessLaunchReadiness(input: LaunchReadinessInput): LaunchReadinessAssessment {
  const highBlockerCount = Math.max(0, Math.floor(input.highBlockerCount));
  const dimensions: LaunchReadinessDimension[] = [
    ...scanDimensions(input.scan),
    {
      id: "recorded-blockers",
      label: "Recorded launch blockers",
      weight: 15,
      status: highBlockerCount > 0 ? "failing" : "verified",
      source: "account-scoped ailhat work ledger",
      detail:
        highBlockerCount > 0
          ? `${highBlockerCount} unresolved high-severity recorded blocker${highBlockerCount === 1 ? "" : "s"}.`
          : "No unresolved high-severity blocker is currently recorded in ailhat. This does not claim that unobserved blockers do not exist.",
    },
    httpsDimension(input.productUrl),
    unknownDimension(
      "conversion-path",
      "Primary conversion path",
      8,
      "The current summarized scan evidence does not prove an end-to-end signup, request, booking, or purchase journey.",
    ),
    unknownDimension(
      "auth-account",
      "Authentication / account flow",
      5,
      "No authenticated end-to-end account-flow result is attached to this assessment.",
    ),
    unknownDimension(
      "mobile-responsive",
      "Mobile / responsive behavior",
      4,
      "The server-side site scan does not execute a responsive browser interaction test.",
    ),
    unknownDimension(
      "measurement",
      "Analytics / measurement",
      4,
      "No authoritative analytics-presence observation is attached to this assessment.",
    ),
    unknownDimension(
      "first-user-journey",
      "First-user journey",
      4,
      "No executed first-user or agent journey result is attached to this assessment.",
    ),
  ];

  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  const observed = dimensions.filter((dimension) => dimension.status !== "unknown");
  const observedWeight = observed.reduce((sum, dimension) => sum + dimension.weight, 0);
  const verifiedWeight = observed
    .filter((dimension) => dimension.status === "verified")
    .reduce((sum, dimension) => sum + dimension.weight, 0);
  const coverage = totalWeight > 0 ? Math.round((observedWeight / totalWeight) * 100) : 0;
  const score =
    input.scan && coverage >= MIN_READINESS_COVERAGE && observedWeight > 0
      ? Math.round((verifiedWeight / observedWeight) * 100)
      : null;

  let confidence: ReadinessConfidence | null = null;
  if (score != null && input.scan) {
    if (coverage >= 85 && input.scan.ageHours < 24) confidence = "High";
    else if (coverage >= MIN_READINESS_COVERAGE && input.scan.ageHours < 72) confidence = "Medium";
    else confidence = "Low";
  }

  const verifiedCount = dimensions.filter((dimension) => dimension.status === "verified").length;
  const failingCount = dimensions.filter((dimension) => dimension.status === "failing").length;
  const unknownCount = dimensions.filter((dimension) => dimension.status === "unknown").length;
  const blockerCount = highBlockerCount + (input.scan?.findings.CRITICAL ?? 0) + (input.scan?.findings.HIGH ?? 0);

  return {
    score,
    coverage,
    confidence,
    verifiedCount,
    failingCount,
    unknownCount,
    blockerCount,
    freshnessHours: input.scan?.ageHours ?? null,
    dimensions,
    reason:
      score == null
        ? `Needs assessment: ${coverage}% of weighted launch evidence is currently observed; ${MIN_READINESS_COVERAGE}% is required before ailhat emits a readiness percentage.`
        : `Readiness summarizes observed weighted dimensions only. ${unknownCount} unknown dimension${unknownCount === 1 ? " remains" : "s remain"} visible as evidence-coverage debt and do not count as failures.`,
  };
}
