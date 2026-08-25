// Ailhat — Agent Direct DEMO portfolio (ANONYMOUS VISITOR SAMPLE DATA).
//
// This is a CLEARLY-INVENTED sample payload shown to unauthenticated visitors so
// they can grasp what the Product / Agent Direct view does BEFORE they sign up.
// Every product here is fictional and explicitly labeled "Sample"/"demo" — it is
// NOT the owner's real portfolio. The owner's real projects (ailhat, ALVIRA,
// Ledgato, etc.) live in portfolio-seed.server.ts and are NEVER served to, or
// bundled for, an anonymous visitor.
//
// Because these names are invented, this module is safe to import from client
// code and is intentionally bundled so an anonymous browser can render the demo.
//
// It reuses the EXACT same scoring/ranking model as the real portfolio
// (control-scoring.ts) so the demo shows genuine readiness/rank behaviour, not a
// static mockup.

import type { Workspace } from "./agent-control";
import { modelWorkspaces, type ModeledWorkspace } from "./control-scoring";

/** Fictional demo workspaces — clearly marked "Sample"/"demo", never the owner's. */
export const DEMO_PORTFOLIO: Workspace[] = [
  {
    id: "demo-acme-launchpad",
    name: "Acme Launchpad (Sample)",
    tagline: "Sample B2B SaaS — fictional demo product",
    summary:
      "Clearly-labeled SAMPLE product used to illustrate the readiness view. Models how a near-launch SaaS surfaces its top blocker, recommended agent window, and next action. This is invented demo data, not a real project.",
    url: "https://acme-launchpad.example.com",
    stage: "Sample · pre-launch demo",
    readinessPct: 62,
    confidence: "Medium",
    firstPaidClient: "~2–3 sample work sessions to a credible demo state",
    dimensions: [
      { label: "Product", value: 80 },
      { label: "Infrastructure", value: 70 },
      { label: "Authentication", value: 65 },
      { label: "Billing", value: 40 },
      { label: "GTM / validation", value: 35 },
    ],
    portfolioState: "ACTIVE",
    attention: "ACT NOW",
    recommendedAgent: "engineer · cto.new Builder (sample)",
    recommendedWindow: "next free sample window",
    estimatedEffort: "1–2 sample sessions",
    launchImpact: 88,
    customerImpact: 80,
    urgency: "HIGH",
    interfaces: {
      CLI: { state: "available", work: "demo-acme-b1" },
      "Web UI": { state: "available", work: "demo-acme-b1" },
      API: { state: "busy" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 1,
    lastScan: "sample baseline · demo evidence",
    scanAgeHours: 4,
    blockers: [
      { id: "demo-acme-b1", title: "Sample · complete checkout billing flow", severity: "high" },
      { id: "demo-acme-b2", title: "Sample · harden onboarding", severity: "medium" },
    ],
    actions: [
      {
        id: "demo-acme-a1",
        title: "P0 · Wire up a working checkout + billing flow (sample)",
        role: "engineer",
        effort: "1–2 sessions",
        window: "next free Builder window (sample)",
        launchImpact: 88,
        customerImpact: 80,
      },
      {
        id: "demo-acme-a2",
        title: "P1 · Reduce onboarding drop-off with guided setup (sample)",
        role: "designer",
        effort: "1 session",
        window: "following sample window",
        launchImpact: 72,
        customerImpact: 75,
      },
    ],
  },
  {
    id: "demo-brightcart",
    name: "Brightcart Storefront (Sample)",
    tagline: "Sample e-commerce storefront — fictional demo product",
    summary:
      "Clearly-labeled SAMPLE storefront product. Shown as NEEDS ASSESSMENT to illustrate that readiness is never fabricated — it stays null until a live scan/assessment runs. This is invented demo data, not a real project.",
    url: "https://brightcart-storefront.example.com",
    stage: "Sample · needs assessment",
    readinessPct: null,
    confidence: null,
    firstPaidClient: "assessment required",
    portfolioState: "NEEDS ASSESSMENT",
    attention: null,
    recommendedAgent: "researcher · cto.new (sample)",
    recommendedWindow: "next free sample assessment window",
    estimatedEffort: "1 sample session (assessment)",
    launchImpact: "MEDIUM",
    customerImpact: "HIGH",
    urgency: "MEDIUM",
    interfaces: {
      CLI: { state: "none" },
      "Web UI": { state: "available", work: "demo-brightcart-b1" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 20,
    lastScan: "no live scan yet · sample scope",
    scanAgeHours: 90,
    blockers: [
      { id: "demo-brightcart-b1", title: "Sample · run first live assessment", severity: "medium" },
    ],
    actions: [
      {
        id: "demo-brightcart-a1",
        title: "Run sample assessment + live scan to ground readiness",
        role: "researcher",
        effort: "1 session",
        window: "next free sample assessment window",
        launchImpact: "MEDIUM",
        customerImpact: "HIGH",
      },
    ],
  },
  {
    id: "demo-nimbus-docs",
    name: "Nimbus Docs (Sample)",
    tagline: "Sample developer-docs product — fictional demo product",
    summary:
      "Clearly-labeled SAMPLE docs product. Uses a healthy baseline with a neglect penalty to illustrate how a live product that has sat silent still surfaces for review. This is invented demo data, not a real project.",
    url: "https://nimbus-docs.example.com",
    stage: "Sample · active demo",
    readinessPct: 74,
    confidence: "High",
    firstPaidClient: "sample validation path defined",
    portfolioState: "STALE",
    attention: "REVIEW",
    recommendedAgent: "engineer · cto.new Builder (sample)",
    recommendedWindow: "next free sample window",
    estimatedEffort: "1 sample session",
    launchImpact: "MEDIUM",
    customerImpact: "MEDIUM",
    urgency: "MEDIUM",
    interfaces: {
      CLI: { state: "available", work: "demo-nimbus-b1" },
      "Web UI": { state: "busy" },
      API: { state: "none" },
      Sandbox: { state: "none" },
    },
    daysSinceAttention: 9,
    lastScan: "stale · last sample scan aged",
    scanAgeHours: 120,
    blockers: [
      { id: "demo-nimbus-b1", title: "Sample · refresh docs + re-verify live links", severity: "medium" },
    ],
    actions: [
      {
        id: "demo-nimbus-a1",
        title: "Re-scan and refresh the sample docs site",
        role: "engineer",
        effort: "1 session",
        window: "next free sample window",
        launchImpact: "MEDIUM",
        customerImpact: "MEDIUM",
      },
    ],
  },
];

/** Model + rank the demo workspaces through the real scoring engine (for `now`). */
export function modelDemoPortfolio(now: number): ModeledWorkspace[] {
  return modelWorkspaces(DEMO_PORTFOLIO, now);
}

/** Marker text for the demo banner — always shown with sample data. */
export const DEMO_CALL = "Sample data — this is a fictional demo portfolio, not your projects.";
