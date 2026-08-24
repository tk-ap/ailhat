// Ailhat Market-Gap Engine — Phase 4 of the proactive-product-intelligence
// upgrade.
//
// Pure logic over AppState (mirrors opportunity.ts / brief.ts). A Market Gap is
// "here is something the category / competitors provide that ailhat does not".
// These are STRUCTURAL / OBSERVED gaps grounded in market-gap research
// (shared/market-gap-research.md, GAPs 1–8), not fabricated share claims.
//
// Evidence-first (owner rule): every gap cites the concrete source/observation
// it comes from. Confidence reflects how well the research verified it.
//
// PRICING CONSTRAint (owner rule): the research flags all competitor prices as
// prior-knowledge / UNVERIFIED and the researcher is running a live
// verification pass in parallel (output: shared/verified-prices.md). So this
// engine NEVER hardcodes a vendor price into user-facing copy unless it comes
// from that verified source. The seeded gaps keep their structural/feature
// content (which is HIGH confidence) and refer to pricing only generically.
//
// SSR-safe: no browser globals, no deps beyond types.

import type { AppState, FeedbackEntry } from "./store";
import type { Confidence } from "./scanSite";
import {
  type Opportunity,
  type OpportunityBucket,
  type OpportunityType,
  bucketOf,
  scoreOpportunity,
} from "./opportunity";

// Synthetic portfolio root — market gaps are portfolio-level, not per-product.
export const PORTFOLIO_ID = "__portfolio__";
export const PORTFOLIO_NAME = "Your portfolio";

export interface MarketGapTemplate {
  id: string; // stable across recompute → feedback can target a gap ("mg-gap-1")
  title: string;
  type: OpportunityType; // MARKET | COMPETITIVE
  category: string; // the category this gap lives in (e.g. "Product analytics")
  description: string; // "category provides vs ailhat omits"
  evidence: string[]; // concrete evidence / source notes
  confidence: Confidence;
  impact: number; // 0..1 potential impact if the gap is closed
  fit: number; // 0..1 strategic fit for ailhat's positioning
  ease: number; // 0..1 ease of closing the gap (high = easy)
  recommendation: string;
  action: string; // the "bridge"
  sourceNote: string; // research citation, e.g. "GAP 2 (HIGH confidence)"
  competitors: string[]; // who already provides this today
}

/** A market gap emitted as a first-class Opportunity (Phase-5 unifiable). */
export interface MarketGapOpportunity extends Opportunity {
  category: string;
  competitors: string[];
  sourceNote: string;
}

// ---------------------------------------------------------------------------
// Seeded templates — encoded from research GAPs 1–5 (the HIGH-value ones).
// Structural/feature facts are HIGH confidence; no vendor price is quoted.
// ---------------------------------------------------------------------------

const TEMPLATES: MarketGapTemplate[] = [
  {
    id: "mg-gap-1",
    title: "Own the unoccupied cross-platform 'what matters next' position",
    type: "MARKET",
    category: "Cross-product intelligence",
    description:
      "Every tool you compared is per-product or per-platform — PostHog, Amplitude, Mixpanel and Plausible give analytics per project; UptimeRobot/BetterStack per endpoint; Linear/Asana a manually-fed work inbox; Vercel/Netlify a single-host dashboard. None aggregates across a multi-host portfolio into a ranked 'what should I do next' feed with evidence + confidence + feedback. That space is ailhat's to occupy.",
    evidence: [
      "Research GAP 1 (HIGH confidence): all named category leaders are per-product or per-platform; none provides ranked cross-portfolio attention.",
      "Category map: product analytics, uptime/status, PM, and hosting tools are each bounded to one project, endpoint, or host.",
    ],
    confidence: "HIGH",
    impact: 0.95,
    fit: 1.0,
    ease: 0.55,
    recommendation:
      "Make the host-agnostic portfolio attention layer the center of ailhat and the differentiator every surface reinforces.",
    action:
      "Keep the ranked portfolio feed (evidence + confidence + feedback + neglect detection) the product's core; resist collapsing into a single-product analytics or PM tool.",
    sourceNote: "GAP 1 · HIGH value · HIGH confidence (research)",
    competitors: ["PostHog", "Amplitude", "Linear", "Vercel"],
  },
  {
    id: "mg-gap-2",
    title: "Add a behavioral / usage analytics layer",
    type: "MARKET",
    category: "Product analytics",
    description:
      "The category's product-analytics tools (PostHog, Amplitude, Mixpanel, Plausible) give builders behavioral signal — events, funnels, retention, conversion — but ailhat today only observes the shipped artifact, not user behavior. A builder gets no usage signal from ailhat's observation alone, so opportunities can't be grounded in what users actually do.",
    evidence: [
      "Research GAP 2 (HIGH confidence): ailhat lacks a behavioral/usage analytics layer; PostHog/Mixpanel/Plausible provide events/funnels/retention/conversion.",
      "Category A summary: all analytics tools are per-project and usage-observing; ailhat observes artifacts, not behavior.",
    ],
    confidence: "HIGH",
    impact: 0.85,
    fit: 0.85,
    ease: 0.5,
    recommendation:
      "Ingest a product-analytics source so behavior becomes evidence that grounds opportunities and attention.",
    action:
      "Bridge: add a product-analytics integration source (e.g. connect PostHog, Plausible, or GA4) so usage/behavior feeds the intelligence pipeline as evidence.",
    sourceNote: "GAP 2 · HIGH value · HIGH confidence (research)",
    competitors: ["PostHog", "Amplitude", "Mixpanel", "Plausible"],
  },
  {
    id: "mg-gap-3",
    title: "Add outbound integrations as ACTION destinations",
    type: "COMPETITIVE",
    category: "Outbound integrations",
    description:
      "Linear, Notion, GitHub Projects, and Asana already receive tasks from builders, but ailhat has zero outbound integrations — its 'create task' step has no destination. Category tools that close the loop to where builders actually work will feel more actionable; ailhat currently ends at its own checklist.",
    evidence: [
      "Research GAP 3 (MED-HIGH confidence): ailhat has no outbound integrations; Linear/Notion/GitHub/Asana are established task destinations.",
      "Category D summary: ailhat is distinct from PM tools (automatically-observed attention vs manually-fed inbox) but the ACTION → create-task step has no destination.",
    ],
    confidence: "MEDIUM",
    impact: 0.8,
    fit: 0.9,
    ease: 0.6,
    recommendation:
      "Close the action loop to the tools builders already work in.",
    action:
      "Bridge: add a Linear / GitHub / Notion action connector so 'create task' pushes to the builder's real work management tool.",
    sourceNote: "GAP 3 · HIGH value · MED-HIGH confidence (research)",
    competitors: ["Linear", "Notion", "GitHub Projects", "Asana"],
  },
  {
    id: "mg-gap-4",
    title: "Ingest the hosts' own observability / status APIs",
    type: "COMPETITIVE",
    category: "Platform observability",
    description:
      "Vercel (Analytics + Observability), Cloudflare (Web Analytics), Railway, and Render all expose per-project metrics/logs/deploy streams — but ailhat doesn't pull any of them. These are readily available ingestion surfaces ailhat currently neglects, and they'd give every product a rich, first-party evidence stream instead of relying on site-scan alone.",
    evidence: [
      "Research GAP 4 (MED confidence): ailhat ignores hosts' own observability/status APIs (Vercel Analytics, Cloudflare Web Analytics, Railway/Render metrics, webhooks).",
      "Category C summary: platforms give infra/usage observability per project on their own platform; ailhat does not yet ingest those streams.",
    ],
    confidence: "MEDIUM",
    impact: 0.8,
    fit: 0.9,
    ease: 0.6,
    recommendation:
      "Ingest each host's analytics/observability/webhook surface to enrich evidence per product.",
    action:
      "Bridge: integrate Vercel / Cloudflare / Railway / Render APIs (deploys, metrics, webhooks) as an evidence source for the pipeline.",
    sourceNote: "GAP 4 · HIGH value · MED confidence (research)",
    competitors: ["Vercel Analytics", "Cloudflare Web Analytics", "Railway", "Render"],
  },
  {
    id: "mg-gap-5",
    title: "Add a public status page + escalatable alerting",
    type: "MARKET",
    category: "Uptime / status",
    description:
      "UptimeRobot, BetterStack, and Atlassian Statuspage all give builders public status pages and incident alerting — but ailhat ships neither. When a product's site goes down, ailhat can detect it but can't publish a status page or escalate to the builder (email/Slack). The category provides this as table stakes; ailhat currently omits it.",
    evidence: [
      "Research GAP 5 (MED confidence): ailhat has no public status page or escalatable alerting; BetterStack/UptimeRobot/Statuspage do.",
      "Category B summary: uptime/status tools provide alerting + status pages but only detect 'down', not 'why/should-fix' — alerting is the missing piece on ailhat's side.",
    ],
    confidence: "MEDIUM",
    impact: 0.7,
    fit: 0.8,
    ease: 0.7,
    recommendation:
      "Give builders a way to broadcast and escalate when something goes down.",
    action:
      "Bridge: add a portfolio status page plus realtime alerts (email/Slack/webhook) that fire on scan-detected outages or regressions.",
    sourceNote: "GAP 5 · HIGH value · MED confidence (research)",
    competitors: ["BetterStack", "UptimeRobot", "Atlassian Statuspage"],
  },
];

export const MARKET_GAP_TEMPLATES: readonly MarketGapTemplate[] = TEMPLATES;

// ---- scoring ----
// Reuse the same weighted 0..100 model (40% impact · 30% evidence · 15% fit ·
// 15% ease). Evidence strength for a market gap derives from the research
// confidence (there is no live scan finding to weigh).
function evidenceScoreOf(conf: Confidence): number {
  switch (conf) {
    case "HIGH":
      return 0.9;
    case "MEDIUM":
      return 0.6;
    default:
      return 0.3;
  }
}

function fromTemplate(t: MarketGapTemplate, now: number): MarketGapOpportunity {
  const score = scoreOpportunity({
    impact: t.impact,
    evidence: evidenceScoreOf(t.confidence),
    fit: t.fit,
    ease: t.ease,
  });
  const status: Opportunity["status"] = "open";
  return {
    // Stable id so feedback can target a gap across recomputes.
    id: t.id,
    productId: PORTFOLIO_ID,
    productName: PORTFOLIO_NAME,
    type: t.type,
    title: t.title,
    description: t.description,
    evidence: t.evidence,
    confidence: t.confidence,
    impact: t.impact,
    evidenceScore: evidenceScoreOf(t.confidence),
    fit: t.fit,
    ease: t.ease,
    effortLabel: t.ease >= 0.75 ? "low" : t.ease >= 0.5 ? "medium" : "high",
    score,
    bucket: bucketOf(score),
    recommendation: t.recommendation,
    action: t.action,
    recentAt: now,
    createdAt: now,
    updatedAt: now,
    status,
    // --- market-gap specifics ---
    category: t.category,
    competitors: t.competitors,
    sourceNote: t.sourceNote,
  };
}

/** Ranked list of market-gap opportunities for the portfolio (pre-feedback). */
export function computeMarketGaps(_state: AppState): MarketGapOpportunity[] {
  const now = Date.now();
  // Portfolio-level: gaps are always relevant regardless of product count.
  return TEMPLATES.map((t) => fromTemplate(t, now));
}

/** Hide gaps the builder acted on / dismissed / marked not important / wrong. */
export function applyMarketGapFeedback(
  gaps: MarketGapOpportunity[],
  feedback: Record<string, FeedbackEntry> | undefined,
  now = Date.now(),
): MarketGapOpportunity[] {
  const hidden = new Set<string>();
  for (const [id, fb] of Object.entries(feedback ?? {})) {
    if (fb.kind === "snoozed") {
      if (fb.until !== undefined && now < fb.until) hidden.add(id);
    } else if (
      fb.kind === "dismissed" ||
      fb.kind === "not_important" ||
      fb.kind === "already_handled" ||
      fb.kind === "wrong" ||
      fb.kind === "acted"
    ) {
      hidden.add(id);
    }
  }
  return gaps.filter((g) => !hidden.has(g.id));
}

/** Deterministic ranking: score desc, then type/title for stability. */
export function rankMarketGaps(
  gaps: MarketGapOpportunity[],
): MarketGapOpportunity[] {
  return [...gaps].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.title.localeCompare(b.title);
  });
}

/** Convenience: compute → filter → rank in one step. */
export function buildMarketGaps(
  state: AppState,
  feedback: Record<string, FeedbackEntry> = state.opportunityFeedback,
): MarketGapOpportunity[] {
  return rankMarketGaps(applyMarketGapFeedback(computeMarketGaps(state), feedback));
}

export type { OpportunityBucket };
