// Ailhat Opportunity Engine — Phase 3 of the proactive-product-intelligence
// upgrade.
//
// Pure logic over AppState (mirrors brief.ts): Observe → classify → score →
// recommend. An Opportunity is something that is NOT necessarily broken but is
// meaningfully worth improving (conversion, SEO, content, UX, positioning, …).
//
// Evidence-first (owner rule): every opportunity is derived ONLY from site-scan
// findings that Phase 2 already observed (state.scans / state.scanHistory). We
// never invent market/competitor claims (that's Phase 4) and never emit an
// opportunity with no evidentiary basis. Each carries the concrete evidence it
// came from, a confidence (how certain we are), a weighted 0-100 score, an
// explained breakdown, and a recommendation/action.
//
// SSR-safe: no browser globals, no deps beyond types.

import type { AppState, FeedbackEntry } from "./store";
import type { Confidence, ScanFinding, Severity } from "./scanSite";

export type OpportunityType =
  | "CONVERSION"
  | "SEO"
  | "CONTENT"
  | "UX"
  | "FEATURE"
  | "INTEGRATION"
  | "POSITIONING"
  | "COMPETITIVE"
  | "MARKET"
  | "GROWTH";

export type OpportunityBucket = "EXCEPTIONAL" | "HIGH" | "MODERATE" | "LOW";

export type OpportunityStatus =
  | "open"
  | "investigating"
  | "actioned"
  | "dismissed";

export interface Opportunity {
  id: string; // stable across recompute → feedback can target it
  productId: string;
  productName: string;
  type: OpportunityType;
  title: string;
  description: string;
  evidence: string[]; // the concrete observed findings that ground this
  confidence: Confidence;
  // --- explained score breakdown (each 0..1) ---
  impact: number; // potential impact if realised
  evidenceScore: number; // strength of the observed evidence
  fit: number; // strategic fit for this portfolio/product
  ease: number; // ease of execution (high = easy)
  effortLabel: "low" | "medium" | "high";
  score: number; // weighted 0..100
  bucket: OpportunityBucket;
  recommendation: string;
  action: string; // concrete suggested action
  recentAt: number; // epoch of the freshest supporting evidence
  createdAt: number;
  updatedAt: number;
  status: OpportunityStatus;
}

export const OPPORTUNITY_TYPES: OpportunityType[] = [
  "CONVERSION",
  "SEO",
  "CONTENT",
  "UX",
  "FEATURE",
  "INTEGRATION",
  "POSITIONING",
  "COMPETITIVE",
  "MARKET",
  "GROWTH",
];

export const TYPE_LABELS: Record<OpportunityType, string> = {
  CONVERSION: "Conversion",
  SEO: "SEO",
  CONTENT: "Content",
  UX: "UX",
  FEATURE: "Feature",
  INTEGRATION: "Integration",
  POSITIONING: "Positioning",
  COMPETITIVE: "Competitive",
  MARKET: "Market",
  GROWTH: "Growth",
};

// Score buckets (owner spec).
export function bucketOf(score: number): OpportunityBucket {
  if (score >= 90) return "EXCEPTIONAL";
  if (score >= 75) return "HIGH";
  if (score >= 50) return "MODERATE";
  return "LOW";
}

export const BUCKET_LABELS: Record<OpportunityBucket, string> = {
  EXCEPTIONAL: "Exceptional",
  HIGH: "High",
  MODERATE: "Moderate",
  LOW: "Low",
};

export const BUCKET_TONE: Record<OpportunityBucket, string> = {
  EXCEPTIONAL: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  HIGH: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  MODERATE: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export const TYPE_TONE: Record<OpportunityType, string> = {
  CONVERSION: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  SEO: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  CONTENT: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  UX: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  FEATURE: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  INTEGRATION: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  POSITIONING: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  COMPETITIVE: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  MARKET: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  GROWTH: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
};

export const CONF_TONE: Record<Confidence, string> = {
  HIGH: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

// ---- scoring ----
// Weighted 0..100 model: Potential Impact × Evidence Strength × Strategic Fit ×
// Ease of Execution. Documented weights below (owner spec lets us choose).
const W = { impact: 0.4, evidence: 0.3, fit: 0.15, ease: 0.15 };

export function scoreOpportunity(input: {
  impact: number;
  evidence: number;
  fit: number;
  ease: number;
}): number {
  const score =
    100 *
    (W.impact * input.impact +
      W.evidence * input.evidence +
      W.fit * input.fit +
      W.ease * input.ease);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function effortLabelOf(ease: number): "low" | "medium" | "high" {
  if (ease >= 0.75) return "low";
  if (ease >= 0.5) return "medium";
  return "high";
}

/** Evidence strength 0..1 from the supporting failing findings. */
function evidenceStrength(fails: ScanFinding[]): number {
  if (fails.length === 0) return 0;
  // Base on count, capped, plus a confidence bonus from HIGH-confidence checks.
  const count = Math.min(fails.length, 4);
  let hi = 0;
  let med = 0;
  for (const f of fails) {
    if (f.confidence === "HIGH") hi++;
    else if (f.confidence === "MEDIUM") med++;
  }
  const countScore = 0.4 + 0.15 * (count - 1);
  const confScore = hi > 0 ? 0.35 : med > 0 ? 0.2 : 0.05;
  return Math.min(1, countScore + confScore);
}

/** Aggregate confidence: HIGH if any HIGH, else MEDIUM if any MEDIUM, else LOW. */
function confidenceOf(fails: ScanFinding[]): Confidence {
  if (fails.some((f) => f.confidence === "HIGH")) return "HIGH";
  if (fails.some((f) => f.confidence === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

interface MkOpt {
  productId: string;
  productName: string;
  type: OpportunityType;
  title: string;
  description: string;
  evidence: ScanFinding[];
  impact: number;
  fit: number;
  ease: number;
  recommendation: string;
  action: string;
  now: number;
}

function mkOpportunity(o: MkOpt): Opportunity {
  const evidenceScore = evidenceStrength(o.evidence);
  const confidence = confidenceOf(o.evidence);
  const score = scoreOpportunity({
    impact: o.impact,
    evidence: evidenceScore,
    fit: o.fit,
    ease: o.ease,
  });
  // Opportunities are recomputed from the freshest successful scan, so the
  // evidence is "as of now"; createdAt/updatedAt reflect this derivation time.
  return {
    id: `opp-${o.type.toLowerCase()}-${o.productId}`,
    productId: o.productId,
    productName: o.productName,
    type: o.type,
    title: o.title,
    description: o.description,
    evidence: o.evidence.map((f) => `${f.title} — ${f.detail}`),
    confidence,
    impact: o.impact,
    evidenceScore,
    fit: o.fit,
    ease: o.ease,
    effortLabel: effortLabelOf(o.ease),
    score,
    bucket: bucketOf(score),
    recommendation: o.recommendation,
    action: o.action,
    recentAt: o.now,
    createdAt: o.now,
    updatedAt: o.now,
    status: "open",
  };
}

// ---- per-rule builders ----
// Each returns an opportunity ONLY when the observed evidence supports it.

function seoOpportunity(
  p: { id: string; name: string },
  fails: ScanFinding[],
  now: number,
): Opportunity | null {
  const relevant = ["missing-og", "missing-meta-description", "short-description"];
  const hits = fails.filter((f) => relevant.includes(f.ruleId));
  if (hits.length === 0) return null; // metadata already healthy → nothing to do
  return mkOpportunity({
    productId: p.id,
    productName: p.name,
    type: "SEO",
    title: `Improve SEO & link previews for ${p.name}`,
    description:
      "Your page has content but is missing or under-serving the metadata that search engines and link previews rely on — so hard-earned traffic shares poorly and ranks less.",
    evidence: hits,
    impact: 0.55,
    fit: 0.7,
    ease: 0.9,
    recommendation: "Add the missing metadata so shared links render richly and pages index better.",
    action: "Add missing Open Graph tags, a 50–160 char meta description, and a descriptive title.",
    now,
  });
}

function conversionPathOpportunity(
  p: { id: string; name: string },
  fails: ScanFinding[],
  now: number,
): Opportunity | null {
  const hits = fails.filter((f) => f.ruleId === "conv-path");
  if (hits.length === 0) return null;
  return mkOpportunity({
    productId: p.id,
    productName: p.name,
    type: "CONVERSION",
    title: `Give ${p.name} a clear conversion path`,
    description:
      "No pricing/plan link and no call-to-action on the page — a visitor who likes what they see has no obvious next step, so intent leaks.",
    evidence: hits,
    impact: 0.85,
    fit: 0.8,
    ease: 0.6,
    recommendation: "Add a comparison/differentiation section and a clear path to buy or sign up.",
    action: "Add a pricing/comparison section plus a prominent primary CTA above the fold.",
    now,
  });
}

function ctaOpportunity(
  p: { id: string; name: string },
  fails: ScanFinding[],
  now: number,
): Opportunity | null {
  const hits = fails.filter((f) => f.ruleId === "ux-primary-cta");
  if (hits.length === 0) return null;
  return mkOpportunity({
    productId: p.id,
    productName: p.name,
    type: "UX",
    title: `Add a clear primary call-to-action on ${p.name}`,
    description:
      "No button or link with obvious action language (sign up, get started, buy, download, …) was found — visitors may not know the next step.",
    evidence: hits,
    impact: 0.6,
    fit: 0.75,
    ease: 0.7,
    recommendation: "Make the primary action obvious and repeat it above the fold.",
    action: "Add an action-oriented primary CTA (sign up / get started / buy) and ensure it's visible without scrolling.",
    now,
  });
}

function pricingActionOpportunity(
  p: { id: string; name: string },
  fails: ScanFinding[],
  now: number,
): Opportunity | null {
  const hits = fails.filter((f) => f.ruleId === "conv-pricing-action");
  if (hits.length === 0) return null;
  return mkOpportunity({
    productId: p.id,
    productName: p.name,
    type: "CONVERSION",
    title: `Give ${p.name}'s pricing page an action`,
    description:
      "The pricing/signup page has no call-to-action button or link to proceed, so someone ready to commit finds nowhere to click.",
    evidence: hits,
    impact: 0.85,
    fit: 0.8,
    ease: 0.6,
    recommendation: "Add a conversion action right on the pricing page.",
    action: "Add per-plan 'Sign up' / 'Get started' buttons and a clear final CTA on every pricing plan.",
    now,
  });
}

function trustOpportunity(
  p: { id: string; name: string },
  fails: ScanFinding[],
  now: number,
): Opportunity | null {
  const hits = fails.filter((f) => f.ruleId === "conv-trust");
  if (hits.length === 0) return null;
  // This finding is a heuristic (LOW confidence) — keep the derived opportunity
  // honest about that, for a plain page can still convert.
  return mkOpportunity({
    productId: p.id,
    productName: p.name,
    type: "CONVERSION",
    title: `Add trust & social proof to ${p.name}`,
    description:
      "No testimonials, reviews, customer, or usage signals were found on the page — visitors have little social proof to lean on before committing.",
    evidence: hits,
    impact: 0.7,
    fit: 0.7,
    ease: 0.6,
    recommendation: "Add customer proof to lift conversion.",
    action: "Add testimonials / reviews / customer logos / usage stats to the landing page.",
    now,
  });
}

function deadEndOpportunity(
  p: { id: string; name: string },
  fails: ScanFinding[],
  now: number,
): Opportunity | null {
  const hits = fails.filter((f) => f.ruleId === "ux-dead-end");
  if (hits.length === 0) return null;
  return mkOpportunity({
    productId: p.id,
    productName: p.name,
    type: "UX",
    title: `Give the ${p.name} page a next step`,
    description:
      "The page looks like a dead end — few actionable links/buttons and little content, so visitors have nowhere to go once they arrive.",
    evidence: hits,
    impact: 0.6,
    fit: 0.7,
    ease: 0.6,
    recommendation: "Expand the page and give visitors an obvious next action.",
    action: "Add more content and a clear next-step link/button so the page doesn't dead-end.",
    now,
  });
}

function positioningOpportunity(
  p: { id: string; name: string },
  fails: ScanFinding[],
  now: number,
): Opportunity | null {
  // Weak/vague title OR very thin content ⇒ the page under-communicates value.
  const relevant = ["content-title", "content-thin"];
  const hits = fails.filter((f) => relevant.includes(f.ruleId));
  if (hits.length === 0) return null;
  return mkOpportunity({
    productId: p.id,
    productName: p.name,
    type: "POSITIONING",
    title: `Sharpen ${p.name}'s positioning`,
    description:
      "The page's title or content is vague or thin, so what the product does — and for whom — isn't communicated clearly to first-time visitors or search engines.",
    evidence: hits,
    impact: 0.6,
    fit: 0.8,
    ease: 0.75,
    recommendation: "Rewrite the headline/title and expand the page to state the value proposition clearly.",
    action: "Write a clear, benefit-led title and add content that explains what the product is, who it's for, and why it's better.",
    now,
  });
}

/** Build every evidence-backed opportunity from the current store state. */
export function computeOpportunities(state: AppState): Opportunity[] {
  const now = Date.now();
  const out: Opportunity[] = [];
  const products = state?.products ?? [];
  const scans = state?.scans ?? {};

  for (const p of products) {
    const scan = scans[p.id];
    if (!scan || !scan.ok) continue; // no successful observation → no evidence
    const fails = scan.findings.filter((f) => f.status === "fail");
    if (fails.length === 0) continue; // healthy → no opportunities

    const prod = { id: p.id, name: p.name };
    const builders = [
      seoOpportunity,
      conversionPathOpportunity,
      ctaOpportunity,
      pricingActionOpportunity,
      trustOpportunity,
      deadEndOpportunity,
      positioningOpportunity,
    ];
    for (const b of builders) {
      const opp = b(prod, fails, now);
      if (opp) out.push(opp);
    }
  }

  return out;
}

// ---- feedback-aware filtering + ranking ----

/** Hide opportunities the builder has acted on / dismissed (not "investigate"). */
export function applyOpportunityFeedback(
  opportunities: Opportunity[],
  feedback: Record<string, FeedbackEntry> | undefined,
  now = Date.now(),
): Opportunity[] {
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
  return opportunities.filter((o) => !hidden.has(o.id));
}

/** Deterministic ranking: score desc, then type/title for stability. */
export function rankOpportunities(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.title.localeCompare(b.title);
  });
}

/** Convenience: compute → filter → rank in one step. */
export function buildOpportunities(
  state: AppState,
  feedback: Record<string, FeedbackEntry> = state.opportunityFeedback,
): Opportunity[] {
  return rankOpportunities(applyOpportunityFeedback(computeOpportunities(state), feedback));
}
