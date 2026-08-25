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
} from "./agent-control";
import type { LiveOverlay } from "./observations";

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

function ageLabel(minutes: number): string {
  if (minutes < 60) return "just now";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function modelWorkspace(ws: Workspace, nowMs: number): ModeledWorkspace {
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

  const minutes = Math.max(1, Math.round(ws.scanAgeHours * 60));
  const evidenceLabel = ageLabel(minutes);
  const evidenceIso = new Date(nowMs - minutes * 60_000).toISOString();

  return {
    ws,
    readiness: ws.readinessPct,
    confidence: ws.confidence,
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
    availableNow,
    actionableNow,
    priority,
    priorityFactors: { launch, customer, urgency, availability, neglect, assessmentBump },
    neglectBumped: neglect >= 0.5 || assessmentBump > 0,
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
): ModeledWorkspace[] {
  return portfolio
    .map((ws) => modelWorkspace(ws, nowMs))
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
