// Ailhat — Agent Control portfolio model + prioritization.
//
// This is the Agent Control (execution-capacity) LAYER. It does NOT rebuild
// ailhat's product-intelligence/scanning engine — product state (readiness,
// confidence, distance, blockers) is bridged from ailhat's portfolio seed
// context (data/portfolio-context.seed.json, the owner's real portfolio), and
// Agent Control adds the execution-capacity view on top: recommended agent/
// provider, capacity window, effort, launch/customer/urgency impact, and
// per-interface (harness) agent availability.
//
// Boundary (PORTFOLIO_AND_AGENT_CONTROL.md):
//   Ailhat:        Observe → Understand → Detect → Prioritize → Recommend
//   Agent Control: Observe capacity → Match work → Reserve window → Execute
//
// Rules honoured:
//   - readinessPct null  => NEEDS ASSESSMENT (never an invented %).
//   - Hoopdash stays NEEDS ASSESSMENT (unassessed) — nothing fabricated.
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

export const seedPortfolio: Workspace[] = [
  // ============================ ailhat (fully modeled) ======================
  {
    id: "ailhat",
    name: "ailhat",
    tagline: "AI product intelligence & market-gap detection",
    summary:
      "The product-intelligence layer: continuously scans a product, identifies bugs and unmet market opportunities, and turns findings into prioritized work for AI coding agents. This Control surface is its execution-capacity counterpart.",
    url: "https://ailhat.vercel.app/",
    stage: "Private beta / pre-launch",
    readinessPct: 65,
    confidence: "Medium",
    firstPaidClient:
      "~4–8 meaningful work sessions to a credible first-customer-ready state",
    dimensions: [
      { label: "Product", value: 82 },
      { label: "Infrastructure", value: 72 },
      { label: "Authentication", value: 60 },
      { label: "Intelligence / scanning", value: 65 },
      { label: "UX", value: 75 },
      { label: "Billing", value: 30 },
      { label: "GTM / customer validation", value: 20 },
    ],
    portfolioState: "ACTIVE",
    attention: "ACT NOW",
    recommendedAgent: "engineer · cto.new Builder",
    recommendedWindow: "next free Builder window",
    estimatedEffort: "2–3 sessions",
    launchImpact: 92,
    customerImpact: 85,
    urgency: "HIGH",
    interfaces: {
      CLI: { state: "available", work: "ah-b1" },
      "Web UI": { state: "available", work: "ah-b3" },
      API: { state: "available", work: "ah-b4" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 2,
    lastScan: "2026-08-24 · prior site scan",
    scanAgeHours: 5,
    blockers: [
      { id: "ah-b1", title: "Production reliability", severity: "high" },
      { id: "ah-b2", title: "Authentication reliability", severity: "high" },
      { id: "ah-b3", title: "Complete the live scanning loop", severity: "medium" },
      { id: "ah-b4", title: "Opportunity → actionable-work pipeline", severity: "medium" },
      { id: "ah-b5", title: "Clear customer-facing value proposition", severity: "medium" },
      { id: "ah-b6", title: "Billing / onboarding", severity: "high" },
      { id: "ah-b7", title: "First-customer validation workflow", severity: "medium" },
    ],
    actions: [
      {
        id: "ah-a1",
        title:
          "P0 · Harden production reliability — fault tolerance, error budgets, load checks",
        role: "engineer",
        effort: "2–3 sessions",
        window: "next free Builder window",
        launchImpact: 92,
        customerImpact: 80,
      },
      {
        id: "ah-a2",
        title:
          "P0 · Fix authentication reliability — login/session edge cases, retries",
        role: "engineer",
        effort: "1–2 sessions",
        window: "Builder window after P0-1",
        launchImpact: 88,
        customerImpact: 85,
      },
      {
        id: "ah-a3",
        title:
          "P1 · Complete the live scanning loop end-to-end — schedule scans, persist evidence",
        role: "engineer",
        effort: "2 sessions",
        window: "Builder window after P0-2",
        launchImpact: 78,
        customerImpact: 70,
      },
    ],
  },

  // ==================== live / strategic — NEEDS ASSESSMENT =================
  {
    id: "alvira",
    name: "ALVIRA",
    tagline: "Context-intelligence / operating-system platform",
    summary:
      "Strategic ecosystem platform — live. Assess ecosystem state and the highest-value next action before scheduling execution capacity.",
    url: "https://alviratech.vercel.app/",
    stage: "Active ecosystem product",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "NEEDS ASSESSMENT",
    attention: null,
    recommendedAgent: "researcher · cto.new",
    recommendedWindow: "next free assessment window",
    estimatedEffort: "1 session (assessment)",
    launchImpact: "MEDIUM",
    customerImpact: "HIGH",
    urgency: "MEDIUM",
    interfaces: {
      CLI: { state: "available", work: "al-b1" },
      "Web UI": { state: "busy" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 21,
    lastScan: "no live scan yet · portfolio scope",
    scanAgeHours: 90,
    blockers: [
      { id: "al-b1", title: "Ecosystem state & highest-value next action require assessment", severity: "medium" },
    ],
    actions: [
      {
        id: "al-a1",
        title: "Run ecosystem assessment + live scan (alviratech.vercel.app)",
        role: "researcher",
        effort: "1 session",
        window: "next free assessment window",
        launchImpact: "MEDIUM",
        customerImpact: "HIGH",
      },
      {
        id: "al-a2",
        title: "Map the highest-value next action from scan evidence",
        role: "researcher",
        effort: "1 session",
        window: "following window",
        launchImpact: "MEDIUM",
        customerImpact: "MEDIUM",
      },
      {
        id: "al-a3",
        title: "Review shared integration surface with ALVIRA Bridge",
        role: "engineer",
        effort: "0.5 session",
        window: "Builder window",
        launchImpact: "LOW",
        customerImpact: "MEDIUM",
      },
    ],
  },

  {
    id: "bridge",
    name: "ALVIRA Bridge",
    tagline: "ALVIRA ecosystem integration layer",
    summary:
      "Ecosystem integration layer. Assess reliability, adoption, and the next product milestone. Draws capacity from the shared cto.new Builder bucket (shared with Ledgato).",
    url: "https://alviratech-bridge.vercel.app/",
    stage: "Active ecosystem product",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "NEEDS ASSESSMENT",
    attention: null,
    sharedBucket: SHARED_BUCKET,
    recommendedAgent: "engineer · cto.new Builder",
    recommendedWindow: "Builder window (shared with Ledgato)",
    estimatedEffort: "1 session (assessment)",
    launchImpact: "MEDIUM",
    customerImpact: "MEDIUM",
    urgency: "MEDIUM",
    interfaces: {
      CLI: { state: "none" },
      "Web UI": { state: "busy" },
      API: { state: "available", work: "br-b1" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 30,
    lastScan: "no live scan yet · portfolio scope",
    scanAgeHours: 110,
    blockers: [
      { id: "br-b1", title: "Assess reliability + adoption of Bridge endpoints", severity: "medium" },
    ],
    actions: [
      {
        id: "br-a1",
        title: "Assess reliability + adoption (alviratech-bridge.vercel.app)",
        role: "engineer",
        effort: "1 session",
        window: "Builder window (shared with Ledgato)",
        launchImpact: "MEDIUM",
        customerImpact: "MEDIUM",
      },
      {
        id: "br-a2",
        title: "Define the next product milestone from scan evidence",
        role: "researcher",
        effort: "1 session",
        window: "following window",
        launchImpact: "MEDIUM",
        customerImpact: "MEDIUM",
      },
      {
        id: "br-a3",
        title: "Verify shared cto.new Builder bucket capacity before scheduling",
        role: "ops",
        effort: "0.25 session",
        window: "any",
        launchImpact: "LOW",
        customerImpact: "LOW",
      },
    ],
  },

  {
    id: "ledgato",
    name: "Ledgato",
    tagline: "Authorization & security control plane for AI agents",
    summary:
      "Authorization and security control plane for AI agents. Live product that has sat silently — flagged STALE for neglect; run product assessment + live scan. Draws capacity from the shared cto.new Builder bucket (shared with ALVIRA Bridge).",
    url: "https://ledgato.vercel.app/",
    stage: "Active product update",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "STALE",
    attention: null,
    sharedBucket: SHARED_BUCKET,
    recommendedAgent: "engineer · cto.new Builder",
    recommendedWindow: "Builder window (shared with ALVIRA Bridge)",
    estimatedEffort: "1–2 sessions (assessment + scan)",
    launchImpact: "HIGH",
    customerImpact: "HIGH",
    urgency: "HIGH",
    interfaces: {
      CLI: { state: "available", work: "lg-b1" },
      "Web UI": { state: "busy" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 45,
    lastScan: "stale · last live scan aged",
    scanAgeHours: 140,
    blockers: [
      { id: "lg-b1", title: "Product assessment + live scan not run", severity: "high" },
      { id: "lg-b2", title: "Known blockers unresolved — need verification against live evidence", severity: "medium" },
    ],
    actions: [
      {
        id: "lg-a1",
        title: "Run product assessment + live scan (ledgato.vercel.app)",
        role: "engineer",
        effort: "1–2 sessions",
        window: "Builder window (shared with ALVIRA Bridge)",
        launchImpact: "HIGH",
        customerImpact: "HIGH",
      },
      {
        id: "lg-a2",
        title: "Verify unresolved known blockers against live evidence",
        role: "engineer",
        effort: "1 session",
        window: "following Builder window",
        launchImpact: "HIGH",
        customerImpact: "MEDIUM",
      },
      {
        id: "lg-a3",
        title: "Reserve Builder capacity — cannot overlap ALVIRA Bridge",
        role: "ops",
        effort: "0.25 session",
        window: "any non-overlap slot",
        launchImpact: "MEDIUM",
        customerImpact: "LOW",
      },
    ],
  },

  // ==================== portfolio inventory — NEEDS ASSESSMENT ==============
  {
    id: "hoopdash",
    name: "Hoopdash",
    tagline: "Live project in hosting portfolio",
    summary:
      "Live project detected in the cto.new hosting portfolio. Needs confirmation + assessment before any readiness score is shown — never fabricated.",
    url: null,
    stage: "Needs assessment",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "NEEDS ASSESSMENT",
    attention: null,
    recommendedAgent: "researcher · cto.new",
    recommendedWindow: "next free assessment window",
    estimatedEffort: "1 session (assessment)",
    launchImpact: "MEDIUM",
    customerImpact: "MEDIUM",
    urgency: "MEDIUM",
    interfaces: {
      CLI: { state: "none" },
      "Web UI": { state: "available", work: "hd-b1" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 60,
    lastScan: "no live scan yet · detected in hosting portfolio",
    scanAgeHours: 200,
    blockers: [
      { id: "hd-b1", title: "Confirm product identity + run first live assessment", severity: "medium" },
    ],
    actions: [
      {
        id: "hd-a1",
        title: "Confirm current state and run the first live assessment",
        role: "researcher",
        effort: "1 session",
        window: "next free assessment window",
        launchImpact: "MEDIUM",
        customerImpact: "MEDIUM",
      },
    ],
  },

  {
    id: "policyguard",
    name: "PolicyGuard",
    tagline: "AI policy, governance & control product",
    summary:
      "AI policy, governance, and control product in the portfolio. Prior portfolio inventory — run assessment/scan before scoring.",
    url: null,
    stage: "Paused · needs assessment",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "PAUSED",
    attention: null,
    recommendedAgent: "researcher · cto.new",
    recommendedWindow: "next free assessment window",
    estimatedEffort: "1 session (assessment)",
    launchImpact: "LOW",
    customerImpact: "LOW",
    urgency: "LOW",
    interfaces: {
      CLI: { state: "none" },
      "Web UI": { state: "available", work: "pg-b1" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 60,
    lastScan: "no live scan yet · portfolio inventory",
    scanAgeHours: 200,
    blockers: [
      { id: "pg-b1", title: "Product status requires live scan (revive vs archive)", severity: "medium" },
    ],
    actions: [
      {
        id: "pg-a1",
        title: "Run product assessment + live scan to confirm status (revive vs archive)",
        role: "researcher",
        effort: "1 session",
        window: "next free assessment window",
        launchImpact: "LOW",
        customerImpact: "LOW",
      },
    ],
  },

  {
    id: "websitehero",
    name: "WEBSITEHERO",
    tagline: "Website-focused product",
    summary:
      "Website-focused product in the portfolio; current product positioning requires a live scan.",
    url: null,
    stage: "Paused · needs assessment",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "PAUSED",
    attention: null,
    recommendedAgent: "researcher · cto.new",
    recommendedWindow: "next free assessment window",
    estimatedEffort: "1 session (assessment)",
    launchImpact: "LOW",
    customerImpact: "LOW",
    urgency: "LOW",
    interfaces: {
      CLI: { state: "none" },
      "Web UI": { state: "available", work: "wh-b1" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 60,
    lastScan: "no live scan yet · portfolio inventory",
    scanAgeHours: 200,
    blockers: [
      { id: "wh-b1", title: "Current product positioning requires live scan", severity: "medium" },
    ],
    actions: [
      {
        id: "wh-a1",
        title: "Run live scan to establish current positioning (revive vs archive)",
        role: "researcher",
        effort: "1 session",
        window: "next free assessment window",
        launchImpact: "LOW",
        customerImpact: "LOW",
      },
    ],
  },

  {
    id: "trendvault",
    name: "TrendVault",
    tagline: "Trend-focused product",
    summary:
      "Trend-focused product in the portfolio; current product positioning requires a live scan.",
    url: null,
    stage: "Paused · needs assessment",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "PAUSED",
    attention: null,
    recommendedAgent: "researcher · cto.new",
    recommendedWindow: "next free assessment window",
    estimatedEffort: "1 session (assessment)",
    launchImpact: "LOW",
    customerImpact: "LOW",
    urgency: "LOW",
    interfaces: {
      CLI: { state: "none" },
      "Web UI": { state: "busy" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 60,
    lastScan: "no live scan yet · portfolio inventory",
    scanAgeHours: 200,
    blockers: [
      { id: "tv-b1", title: "Current product positioning requires live scan", severity: "medium" },
    ],
    actions: [
      {
        id: "tv-a1",
        title: "Run live scan to establish current positioning (revive vs archive)",
        role: "researcher",
        effort: "1 session",
        window: "next free assessment window",
        launchImpact: "LOW",
        customerImpact: "LOW",
      },
    ],
  },

  {
    id: "adscale-pro",
    name: "AdScale Pro",
    tagline: "Advertising / growth product",
    summary:
      "Advertising / growth product in the portfolio; current product positioning requires a live scan.",
    url: null,
    stage: "Paused · needs assessment",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "PAUSED",
    attention: null,
    recommendedAgent: "researcher · cto.new",
    recommendedWindow: "next free assessment window",
    estimatedEffort: "1 session (assessment)",
    launchImpact: "LOW",
    customerImpact: "LOW",
    urgency: "LOW",
    interfaces: {
      CLI: { state: "none" },
      "Web UI": { state: "none" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 60,
    lastScan: "no live scan yet · portfolio inventory",
    scanAgeHours: 200,
    blockers: [
      { id: "ad-b1", title: "Current product positioning requires live scan", severity: "medium" },
    ],
    actions: [
      {
        id: "ad-a1",
        title: "Run live scan to establish current positioning (revive vs archive)",
        role: "researcher",
        effort: "1 session",
        window: "next free assessment window",
        launchImpact: "LOW",
        customerImpact: "LOW",
      },
    ],
  },
];
