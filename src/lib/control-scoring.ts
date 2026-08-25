// Deterministic scoring + ranking model for the Ailhat — Agent Direct surface.
// Every metric is computed purely from a Workspace's inputs — the same inputs
// always produce the same result.
//
// Ranking model (PORTFOLIO_AND_AGENT_CONTROL.md):
//   launch impact × customer value × urgency × agent availability
//   PLUS a neglected-time penalty so live products that have sat silent still
//   surface — ailhat must NOT consume 100% of recommendations just because it
//   is best-assessed.

import {
  HARNESSES,
  type Harness,
  type Impact,
  type Workspace,
  freshnessFromAge,
} from "./agent-control";
import type { LiveOverlay, ScanEvidence } from "./observations";
import { stalenessConfidence } from "./observations";

export interface ModeledWorkspace {
  ws: Workspace;
  /** 0-100 when assessed; null => NEEDS ASSESSMENT (never a fabricated %). */
  readiness: number | null;
  confidence: string | null;
  distanceLabel: string;
  blockers: { id: string; title: string; severity: string }[];
  nextActions: Workspace["actions"];
  recommendedAgent: string;
  recommendedWindow: string;
  estimatedEffort: string;
  launchImpact: Impact;
  customerImpact: Impact;
  urgencyImpact: Impact;
  evidenceLabel: string;
  evidenceIso: string;
  /**
   * How this product's readiness/confidence figures were derived.
   * - "computed-live": recomputed from live scan/observation evidence (anchored on
   *   the seeded baseline, adjusted by evidence age, findings, HIGH blockers).
   * - "anchored-seed": directional baseline from seed — no live evidence yet.
   * - "unassessed": no % exists (NEEDS ASSESSMENT) — never invented.
   */
  evidenceBasis: "computed-live" | "anchored-seed" | "unassessed";
  availableNow: Harness[];
  actionableNow: Harness[];
  /** Composite priority used to rank the portfolio. */
  priority: number;
  priorityFactors: {
    launch: number;
    customer: number;
    urgency: number;
    availability: number;
    neglect: number;
    assessmentBump: number;
  };
  neglectBumped: boolean;
  live?: LiveOverlay;
  scan?: ScanEvidence;
}

function impactVal(v: Impact): number {
  if (typeof v === "number") return Math.max(0, Math.min(100, v)) / 100;
  switch (v) {
    case "HIGH":
      return 0.9;
    case "MEDIUM":
      return 0.6;
    default:
      return 0.3;
  }
}

export function impactLabel(v: Impact): string {
  if (typeof v === "number") return `${v}/100`;
  return v;
}

const NEGLECT_DAYS = 7;
const NEGLECT_WEIGHT = 8; // max priority points from neglect
const ASSESSMENT_BUMP = 7; // unassessed products need a scan → small nudge up

// ---- Readiness recomputation weights (R1: evidence-driven, honest) ----
// A completed live scan/observation turns the seeded directional baseline into a
// "computed-live" figure. The recompute is CONSERVATIVE — evidence age, live
// findings, and unresolved HIGH blockers can only keep or LOWER a product's
// readiness, never raise it above what the seed baseline already supports. A
// null seeded readiness always stays null (NEEDS ASSESSMENT): a scan's finding
// count alone can never justify inventing a percentage.
const FINDING_WEIGHTS: Record<"CRITICAL" | "HIGH" | "MEDIUM", number> = {
  CRITICAL: 3,
  HIGH: 2,
  MEDIUM: 1,
};
const MAX_FINDING_PENALTY = 15; // cap on the finding penalty per scan
const UNREACHABLE_PENALTY = 10; // site down is a strong negative signal
const HIGH_BLOCKER_CEILING_STEP = 12; // each unresolved high blocker caps readiness
const BLOCKER_CEILING_FLOOR = 40;
const STALENESS_DECAY_MIN = 0.85; // multipliers for the evidence-age decay (1.0 → min)

/**
 * Recompute launch readiness from live evidence, anchored on the seeded
 * directional baseline. Pure + deterministic: same inputs, same output.
 *
 *   readiness = clamp(seedBaseline − findingPenalty, …, blockerCeiling)
 *               × evidenceAgeDecay
 *
 * - findingPenalty: failing checks from the latest scan (CRITICAL/HIGH/MEDIUM).
 * - blockerCeiling: unresolved HIGH blockers cap how ready we claim it is.
 * - evidenceAgeDecay: gentle (0.85..1.0) — staleness is mostly surfaced via the
 *   confidence tier, not by crashing the readiness number.
 */
export function recomputeReadiness(
  ws: Workspace,
  scan: ScanEvidence | null,
  evidenceAgeHours: number,
): number {
  const base = ws.readinessPct ?? 65; // only called when a seeded % exists
  let penalty = 0;
  if (scan) {
    if (!scan.ok) penalty += UNREACHABLE_PENALTY;
    penalty +=
      scan.findings.CRITICAL * FINDING_WEIGHTS.CRITICAL +
      scan.findings.HIGH * FINDING_WEIGHTS.HIGH +
      scan.findings.MEDIUM * FINDING_WEIGHTS.MEDIUM;
    penalty = Math.min(penalty, MAX_FINDING_PENALTY + (scan.ok ? 0 : UNREACHABLE_PENALTY));
  }
  const highBlockers = ws.blockers.filter((b) => b.severity === "high").length;
  const blockerCeiling = Math.max(
    BLOCKER_CEILING_FLOOR,
    100 - highBlockers * HIGH_BLOCKER_CEILING_STEP,
  );
  const freshness = Math.max(0, freshnessFromAge(evidenceAgeHours) / 100); // 1..0.3
  const raw = Math.max(5, base - penalty);
  return Math.max(
    5,
    Math.round(Math.min(raw, blockerCeiling) * (STALENESS_DECAY_MIN + (1 - STALENESS_DECAY_MIN) * freshness)),
  );
}

function ageLabel(minutes: number): string {
  if (minutes < 60) return "just now";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function modelWorkspace(
  ws: Workspace,
  nowMs: number,
  ev?: { scan?: ScanEvidence | null; live?: LiveOverlay | null },
): ModeledWorkspace {
  const availableNow = HARNESSES.filter(
    (h) => ws.interfaces[h].state === "available",
  );
  const actionableNow = HARNESSES.filter(
    (h) => ws.interfaces[h].state === "available" && ws.interfaces[h].work,
  );

  // Agent availability factor: how many interfaces have an agent free right
  // now. Floored at 0.3 so a momentarily-busy workspace never scores zero.
  const availability = 0.3 + 0.7 * (availableNow.length / HARNESSES.length);

  const launch = impactVal(ws.launchImpact);
  const customer = impactVal(ws.customerImpact);
  const urgency = impactVal(ws.urgency);

  const neglect = Math.min(1, ws.daysSinceAttention / NEGLECT_DAYS);
  const assessmentBump = ws.readinessPct === null ? ASSESSMENT_BUMP : 0;

  const base = launch * customer * urgency * availability;
  const priority =
    Math.round(base * 100 + neglect * NEGLECT_WEIGHT + assessmentBump);

  const distanceLabel = ws.firstPaidClient;

  // ---- R1: evidence-driven readiness + confidence -------------------------
  // Readiness/confidence become a function of live evidence (age → staleness
  // tiers, live scan findings, unresolved HIGH blockers) rather than the sole
  // seeded constants. Honesty preserved: no live evidence → the seeded
  // directional baseline stands (anchored-seed); a null seeded readiness is
  // NEVER converted into an invented %. Provenance is surfaced via `evidenceBasis`.
  const scan = ev?.scan ?? null;
  const live = ev?.live ?? null;
  const hasLiveEvidence = !!(scan || live);
  const evidenceAgeHours = scan
    ? scan.ageHours
    : live
      ? live.ageHours
      : ws.scanAgeHours;

  let readiness = ws.readinessPct;
  let confidence = ws.confidence;
  let evidenceBasis: ModeledWorkspace["evidenceBasis"] =
    ws.readinessPct === null ? "unassessed" : "anchored-seed";

  if (hasLiveEvidence) {
    // Confidence now follows the staleness tier (fresh <1h High, <24h Med, >24h Low).
    confidence = stalenessConfidence(evidenceAgeHours);
    if (ws.readinessPct !== null) {
      readiness = recomputeReadiness(ws, scan, evidenceAgeHours);
      evidenceBasis = "computed-live";
    }
    // else: readiness stays null → NEEDS ASSESSMENT (never invented).
  }

  const minutes = Math.max(1, Math.round(evidenceAgeHours * 60));
  const evidenceLabel = ageLabel(minutes);
  const evidenceIso = new Date(nowMs - minutes * 60_000).toISOString();

  return {
    ws,
    readiness,
    confidence,
    distanceLabel,
    blockers: ws.blockers.map((b) => ({
      id: b.id,
      title: b.title,
      severity: b.severity,
    })),
    nextActions: ws.actions,
    recommendedAgent: ws.recommendedAgent,
    recommendedWindow: ws.recommendedWindow,
    estimatedEffort: ws.estimatedEffort,
    launchImpact: ws.launchImpact,
    customerImpact: ws.customerImpact,
    urgencyImpact: ws.urgency,
    evidenceLabel,
    evidenceIso,
    evidenceBasis,
    availableNow,
    actionableNow,
    priority,
    priorityFactors: { launch, customer, urgency, availability, neglect, assessmentBump },
    neglectBumped: neglect >= 0.5 || assessmentBump > 0,
    live: live ?? undefined,
    scan: scan ?? undefined,
  };
}

/**
 * Model + rank a portfolio.
 *
 * Takes the portfolio explicitly (NOT a global import) so the seed data — the
 * owner's private project inventory — can live in a server-only module and never
 * reach the client bundle. The client only needs `leaderReason` (and types); the
 * modeling/ranking runs server-side inside control-query.ts.
 *
 * Primary order: composite priority (launch × customer × urgency × availability
 * + neglect penalty + assessment bump). Ties break toward the higher assessed
 * readiness (best-evidenced product leads), then alphabetical.
 */
export function modelWorkspaces(
  portfolio: Workspace[],
  nowMs: number,
  evidence?: {
    scanByWorkspace?: Map<string, ScanEvidence>;
    liveByWorkspace?: Map<string, LiveOverlay>;
  },
): ModeledWorkspace[] {
  return portfolio
    .map((ws) =>
      modelWorkspace(ws, nowMs, {
        scan: evidence?.scanByWorkspace?.get(ws.id) ?? null,
        live: evidence?.liveByWorkspace?.get(ws.id) ?? null,
      }),
    )
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const ra = a.readiness ?? -1;
      const rb = b.readiness ?? -1;
      if (rb !== ra) return rb - ra;
      return a.ws.name.localeCompare(b.ws.name);
    });
}

/** Human-readable "why this leads" for the top recommendation. */
export function leaderReason(m: ModeledWorkspace): string {
  const f = m.priorityFactors;
  const parts: string[] = [];
  parts.push(
    `${Math.round(f.launch * 100)} launch × ${Math.round(f.customer * 100)} customer × ${Math.round(f.urgency * 100)} urgency × ${Math.round(f.availability * 100)} availability`,
  );
  if (f.neglect >= 0.5)
    parts.push(`+${Math.round(f.neglect * NEGLECT_WEIGHT)}pt neglect penalty (${m.ws.daysSinceAttention}d since attention)`);
  else parts.push(`+${Math.round(f.neglect * NEGLECT_WEIGHT)}pt neglect penalty`);
  if (f.assessmentBump > 0)
    parts.push(`+${f.assessmentBump}pt assessment bump (needs scan)`);
  return parts.join(" · ");
}
