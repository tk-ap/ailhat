// Ailhat — Agent Direct portfolio model + prioritization.
//
// This is the Agent Direct (execution-capacity) LAYER. It does NOT rebuild
// ailhat's product-intelligence/scanning engine — product state (readiness,
// confidence, distance, blockers) is bridged from ailhat's portfolio seed
// context (data/portfolio-context.seed.json, the owner's real portfolio), and
// Agent Direct adds the execution-capacity view on top: recommended agent/
// provider, capacity window, effort, launch/customer/urgency impact, and
// per-interface (harness) agent availability.
//
// Boundary (PORTFOLIO_AND_AGENT_CONTROL.md):
//   Ailhat:        Observe → Understand → Detect → Prioritize → Recommend
//   Agent Direct:  Observe capacity → Match work → Reserve window → Execute
//
// Rules honoured:
//   - readinessPct null  => NEEDS ASSESSMENT (never an invented %).
//   - Shared cto.new Builder bucket serves Ledgato + ALVIRA Bridge.
//   - Prioritization = launch × customer × urgency × availability
//     + neglected-time penalty (7-day threshold) + assessment bump.

export type Severity = "high" | "medium" | "low";
export type Role = "engineer" | "researcher" | "designer" | "ops";

// Qualitative impact (HIGH/MEDIUM/LOW) OR an exact numeric value where the data
// justifies one (ailhat's modeled work). Never fabricate an exact delta without
// evidence — use qualitative HIGH/MEDIUM/LOW otherwise.
export type Impact = number | "HIGH" | "MEDIUM" | "LOW";

// NORTH_STAR attention states (assessed workspaces).
export type AttentionState = "ACT NOW" | "REVIEW" | "OPPORTUNITY" | "HEALTHY";
// Portfolio states (PORTFOLIO_AND_AGENT_CONTROL.md).
export type PortfolioState =
  | "ACTIVE"
  | "NEEDS ATTENTION"
  | "STALE"
  | "BLOCKED"
  | "HEALTHY"
  | "NEEDS ASSESSMENT"
  | "PAUSED";

export type Harness = "CLI" | "Web UI" | "API" | "Sandbox";
export type SlotState = "available" | "busy" | "none";

export const HARNESSES: Harness[] = ["CLI", "Web UI", "API", "Sandbox"];

export interface InterfaceSlot {
  state: SlotState;
  /** Blocker id this interface can act on. */
  work?: string;
}

export const SLOT_LABEL: Record<SlotState, string> = {
  available: "Available",
  busy: "Busy",
  none: "No agent",
};

export interface Dimension {
  label: string;
  value: number; // 0-100
}

export interface Blocker {
  id: string;
  title: string;
  severity: Severity;
}

export interface Action {
  id: string;
  title: string;
  role: Role;
  effort: string;
  window: string;
  launchImpact: Impact;
  customerImpact: Impact;
}

export interface Workspace {
  id: string;
  /** Product / company display name (ailhat is always lowercase). */
  name: string;
  tagline: string;
  summary: string;
  url: string | null;
  stage: string;
  readinessPct: number | null;
  confidence: string | null;
  firstPaidClient: string;
  dimensions?: Dimension[];
  portfolioState: PortfolioState;
  attention: AttentionState | null;
  sharedBucket?: string;
  recommendedAgent: string;
  recommendedWindow: string;
  estimatedEffort: string;
  launchImpact: Impact;
  customerImpact: Impact;
  urgency: Impact;
  interfaces: Record<Harness, InterfaceSlot>;
  daysSinceAttention: number;
  lastScan: string;
  scanAgeHours: number;
  blockers: Blocker[];
  actions: Action[];
}

// Evidence-freshness curve: 100 at t=0, decays as scans age.
export function freshnessFromAge(hours: number): number {
  if (hours <= 0.05) return 100;
  if (hours >= 96) return 30;
  return Math.max(30, Math.round(100 - (100 - 30) * (hours / 96)));
}

// The shared cto.new Builder execution bucket (consumed by Ledgato + Bridge).
export const SHARED_BUCKET = "cto.new Builder";

