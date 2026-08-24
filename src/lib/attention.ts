// Ailhat Attention Engine — Phase 5 of the proactive-product-intelligence
// upgrade. THE flagship phase.
//
// Phase 5 unifies EVERYTHING Phases 1–4 already produce — bugs + risks (the scan
// finding system), opportunities (Phase 3) and market gaps (Phase 4) — into ONE
// ranked "WHAT SHOULD I DO NEXT?" feed. Each item is attention-classed with
// evidence + reasoning + a recommendation (score + confidence) + a concrete
// action, and a feedback loop personalises prioritisation over time
// (act / dismiss / snooze / mark-incorrect adjusts future ranking).
//
// OWNER-ENDORSED BACKBONE: agent-availability's "Capacity + Next-Window
// allocation" becomes the ranking backbone. computeCapacity reads AI-operating
// CAPACITY signals straight from observable state (products in motion, open
// findings, open items = attention already spent) and derives a 0..1 capacity
// plus a "next window worth spending on" (the highest marginal value-to-effort
// item right now). That capacity then WEIGHTS what deserves attention: when
// capacity is low, only severe ACT_NOW bugs surface and low-value REVIEW /
// OPPORTUNITY items are pushed down; when capacity is high, opportunities are
// surfaced higher. It is EVIDENCE-DRIVEN from observable signals + confidence —
// never a hand-maintained board — keeping it aligned with the no-generic-PM
// non-goal.
//
// SSR-safe: pure functions over AppState, no browser globals.

import type { AppState, FeedbackEntry } from "./store";
import type { Confidence, ScanFinding, Severity } from "./scanSite";
import type { Opportunity, OpportunityType } from "./opportunity";
import { computeOpportunities, rankOpportunities } from "./opportunity";
import {
  PORTFOLIO_ID,
  PORTFOLIO_NAME,
  computeMarketGaps,
  rankMarketGaps,
} from "./marketGap";
// Reuse the canonical attention levels/order from the Daily Brief so the whole
// Intelligence surface shares ONE vocabulary (and one tone set).
import type { AttentionLevel } from "./brief";
import { LEVEL_ORDER } from "./brief";

export type { AttentionLevel };

/** Phase-5 identity of the unified attention classes (alias of brief's levels). */
export type AttentionClass = AttentionLevel;

export const ATTENTION_CLASSES: AttentionClass[] = [
  "ACT_NOW",
  "REVIEW",
  "OPPORTUNITY",
  "HEALTHY",
];

export const ATTENTION_ORDER: Record<AttentionClass, number> = LEVEL_ORDER;

// The four classes with labels + tones, kept consistent with the existing
// LEVEL_TONE / TYPE_TONE / BUCKET_TONE conventions (dark command-center, Ailhat
// identity, NO purple).
export const ATTENTION_LABELS: Record<AttentionClass, string> = {
  ACT_NOW: "Act now",
  REVIEW: "Review",
  OPPORTUNITY: "Opportunity",
  HEALTHY: "Healthy",
};

export const ATTENTION_TONE: Record<AttentionClass, string> = {
  ACT_NOW: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  OPPORTUNITY:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  HEALTHY: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export const ATTENTION_DOT: Record<AttentionClass, string> = {
  ACT_NOW: "bg-rose-500",
  REVIEW: "bg-amber-500",
  OPPORTUNITY: "bg-emerald-500",
  HEALTHY: "bg-gray-400 dark:bg-gray-600",
};

export const ATTENTION_BORDER: Record<AttentionClass, string> = {
  ACT_NOW: "border-rose-900/40",
  REVIEW: "border-amber-900/40",
  OPPORTUNITY: "border-emerald-900/40",
  HEALTHY: "border-gray-800",
};

/** Where an attention item came from — lets feedback + action target the source. */
export type AttentionSource = "BUG" | "RISK" | "OPPORTUNITY" | "MARKET_GAP";

export type AttentionStatus = "open" | "investigating" | "actioned" | "dismissed";

/**
 * A unified attention item. Opportunity/gap sources reuse the existing
 * Opportunity shape (via `sourceOpp`); bugs/risks wrap the ScanFinding into the
 * same attention shape, keeping severity + evidence + confidence.
 */
export interface AttentionItem {
  // Stable source id (opportunity id, market-gap id, or a finding's stableKey) —
  // feedback and actions target this across recomputes.
  id: string;
  source: AttentionSource;
  kind: OpportunityType | "BUG" | "RISK"; // granular type for chips
  productId: string;
  productName: string;
  title: string;
  description: string;
  evidence: string[];
  reasoning: string; // how the evidence led to this recommendation
  recommendation: string;
  action: string;
  score: number; // ranked 0..100 (capacity + feedback weighted)
  baseScore: number; // pre-capacity/pre-feedback source score (0..100)
  confidence: Confidence;
  severity?: Severity; // bugs/risks only
  attentionClass: AttentionClass;
  status: AttentionStatus;
  effortLabel?: "low" | "medium" | "high";
  // For bugs/risks: which finding + what checklist item type it maps to.
  finding?: ScanFinding;
  recType?: "bug" | "issue" | "feature";
  scanKey?: string; // for idempotent create-task dedup
  // For opportunity/market-gap sources, the originating Opportunity object.
  sourceOpp?: Opportunity;
}

/** How much attention/effort is available right now (observable, not a board). */
export interface CapacitySignals {
  productCount: number;
  productsInMotion: number; // products with a successful scan OR ≥1 open item
  openFindings: number; // total open (fail) findings across scanned products
  openItems: number; // total open checklist items across the portfolio
  allocatedSpend: number; // 0..1 — attention already committed this window
  capacity: number; // 0..1 — free attention available (1 - allocatedSpend)
  // "next window worth spending on" — highest marginal value-to-effort item now.
  nextWindowId: string | null;
  nextWindowLabel: string | null;
}

// ---------------------------------------------------------------------------
// Attention-classification from the weighted score (bucketOf-style).
// ---------------------------------------------------------------------------
export function attentionClassOf(score: number): AttentionClass {
  if (score >= 80) return "ACT_NOW";
  if (score >= 60) return "REVIEW";
  if (score >= 35) return "OPPORTUNITY";
  return "HEALTHY";
}

// ---------------------------------------------------------------------------
// Source scoring
// ---------------------------------------------------------------------------
// Bugs/risks get a deterministic base score from severity, nudged by confidence
// (HIGH keeps it, LOW/MEDIUM lower it a bit — we assert weaker observations less
// loudly). Opportunities/gaps reuse their own already-evidence-backed score.
const SEV_TO_BASE: Record<Severity, number> = {
  CRITICAL: 95,
  HIGH: 82,
  MEDIUM: 62,
  LOW: 34,
};

function findingBaseScore(f: ScanFinding): number {
  const raw = SEV_TO_BASE[f.severity] ?? 40;
  const confAdj = f.confidence === "HIGH" ? 0 : f.confidence === "MEDIUM" ? -6 : -12;
  return Math.max(0, Math.min(100, raw + confAdj));
}

function sourceFromSeverity(sev: Severity): AttentionSource {
  // CRITICAL/HIGH findings are BUGs; MEDIUM/LOW findings are RISKs (consistent
  // with severityToItemType → 'bug'/'issue').
  return sev === "CRITICAL" || sev === "HIGH" ? "BUG" : "RISK";
}

// ---------------------------------------------------------------------------
// Capacity — agent-availability backbone (evidence-derived, no fabrication).
// ---------------------------------------------------------------------------
/**
 * Computes how much AI-operating attention is available right now.
 *   - productsInMotion: products with a successful scan OR ≥1 open item.
 *   - allocatedSpend:   per-product attention already committed, normalised to
 *                       the portfolio size. Each product's open workload is the
 *                       lesser of (open items / 3) and 1, plus a smaller share
 *                       for open findings (a finding demands less than a task).
 *   - capacity = 1 - allocatedSpend: the free attention available to spend on
 *                       NEW things (opportunities, growth) rather than already-
 *                       committed fixes.
 * This is grounded purely in observable store signals.
 */
export function computeCapacity(state: AppState): CapacitySignals {
  const products = state?.products ?? [];
  const scans = state?.scans ?? {};
  const items = state?.items ?? [];

  const openItemsByProduct = new Map<string, number>();
  const openItemsTotal = items.filter((i) => i.status !== "done").length;
  for (const i of items) {
    if (i.status === "done") continue;
    openItemsByProduct.set(i.productId, (openItemsByProduct.get(i.productId) ?? 0) + 1);
  }

  let openFindings = 0;
  let productsInMotion = 0;
  const allocatedByProduct = new Map<string, number>();
  for (const p of products) {
    const scan = scans[p.id];
    const fails = scan && scan.ok ? scan.findings.filter((f) => f.status === "fail") : [];
    openFindings += fails.length;
    const openItems = openItemsByProduct.get(p.id) ?? 0;
    if (fails.length > 0 || openItems > 0) productsInMotion++;
    const workload = Math.min(1, openItems / 3) + Math.min(1, fails.length / 12) * 0.5;
    allocatedByProduct.set(p.id, Math.min(1, workload));
  }

  const maxSpend = Math.max(1, products.length * 1.0);
  const totalAllocated = products.reduce(
    (sum, p) => sum + (allocatedByProduct.get(p.id) ?? 0),
    0,
  );
  const allocatedSpend = Math.max(0, Math.min(1, totalAllocated / maxSpend));
  const capacity = 1 - allocatedSpend;

  return {
    productCount: products.length,
    productsInMotion,
    openFindings,
    openItems: openItemsTotal,
    allocatedSpend,
    capacity,
    nextWindowId: null, // filled in by computeAttention after ranking
    nextWindowLabel: null,
  };
}

// ---------------------------------------------------------------------------
// Ranking — capacity + feedback weighting
// ---------------------------------------------------------------------------
// Capacity shapes the feed:
//  - Bugs/risks (broken things) always demand attention; their weighted score
//    tracks the source score, so severe bugs stay on top regardless of load.
//  - Opportunities/gaps are *optional* improvements and need free capacity to
//    be worth surfacing. We scale their score by (0.55 + 0.45 * capacity): at
//    low capacity they sink (only the most severe ACT_NOW bugs stand out),
//    at high capacity they rise and compete with REVIEW items.
// Feedback personalises futher (see personalizeScore below).

export function capacityWeightedScore(
  item: AttentionItem,
  capacity: number,
): number {
  if (item.source === "OPPORTUNITY" || item.source === "MARKET_GAP") {
    return Math.round(item.baseScore * (0.55 + 0.45 * capacity));
  }
  return item.baseScore;
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Personalisation: adjust an item's final score from prior feedback so the same
 * source ranks differently next time. "more"/investigate bumps it up; everything
 * the user explicitly de-prioritised (dismissed/not_important/already_handled/
 * wrong) is hidden entirely by applyAttentionFeedback — this adjusts ranking for
 * the non-suppressing kinds only.
 */
function personalizeScore(
  item: AttentionItem,
  feedback: Record<string, FeedbackEntry> | undefined,
  opportunityFeedback: Record<string, FeedbackEntry> | undefined,
): number {
  const fbMap =
    item.source === "OPPORTUNITY" || item.source === "MARKET_GAP"
      ? opportunityFeedback
      : feedback;
  const fb = fbMap?.[item.id];
  if (!fb) return item.score;
  if (fb.kind === "more") return clamp100(item.score + 8);
  if (fb.kind === "acted") return item.score; // handled elsewhere (hidden)
  return item.score;
}

// ---------------------------------------------------------------------------
// Feedback filtering (reuses the existing store lifecycle semantics)
// ---------------------------------------------------------------------------
// Bugs/risks are keyed in state.feedback (like brief scan signals); opportunities
// and market gaps are keyed in state.opportunityFeedback (like Phase 3/4). Both
// share the same hide semantics: snoozed-until hides for its duration; dismissed/
// acted/not_important/already_handled/wrong hide until the signal actually
// changes.
export function applyAttentionFeedback(
  items: AttentionItem[],
  feedback: Record<string, FeedbackEntry> | undefined,
  opportunityFeedback: Record<string, FeedbackEntry> | undefined,
  now = Date.now(),
): AttentionItem[] {
  const hidden = new Set<string>();
  const consider = (map: Record<string, FeedbackEntry> | undefined) => {
    for (const [id, fb] of Object.entries(map ?? {})) {
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
  };
  consider(feedback);
  consider(opportunityFeedback);
  return items.filter((it) => !hidden.has(it.id));
}

/** Deterministic ranking: final score desc, then class priority for stability. */
export function rankAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const lo = ATTENTION_ORDER[a.attentionClass] - ATTENTION_ORDER[b.attentionClass];
    if (lo !== 0) return lo;
    if (a.productName !== b.productName) return a.productName.localeCompare(b.productName);
    return a.title.localeCompare(b.title);
  });
}

// ---------------------------------------------------------------------------
// Dedup: a severe bug and its softer opportunity don't double-count.
// ---------------------------------------------------------------------------
// The opportunity engine derives opportunities from specific findings. When a
// product has a CRITICAL/HIGH finding behind an opportunity, we keep the BUG
// (it's the urgent framing) and drop the derivative opportunity so the same
// concern isn't counted twice in the feed. MEDIUM/LOW findings keep their
// opportunity (they aren't severe enough to warrant a separate bug item).
const OPP_TO_RULES: Record<OpportunityType, string[]> = {
  SEO: ["missing-og", "missing-meta-description", "short-description"],
  CONVERSION: ["conv-path", "conv-pricing-action", "conv-trust"],
  UX: ["ux-primary-cta", "ux-dead-end"],
  POSITIONING: ["content-title", "content-thin"],
  CONTENT: [],
  FEATURE: [],
  INTEGRATION: [],
  COMPETITIVE: [],
  MARKET: [],
  GROWTH: [],
};

function opportunityRuleDedup(
  opps: Opportunity[],
  severeFindingsByProduct: Map<string, Set<string>>,
): Set<string> {
  const drop = new Set<string>();
  for (const o of opps) {
    const rules = OPP_TO_RULES[o.type] ?? [];
    const severe = severeFindingsByProduct.get(o.productId);
    if (!severe) continue;
    if (rules.some((r) => severe.has(r))) drop.add(o.id);
  }
  return drop;
}

// ---------------------------------------------------------------------------
// Gather — build the full unified item list.
// ---------------------------------------------------------------------------
export function computeAttention(state: AppState): AttentionItem[] {
  const products = state?.products ?? [];
  const scans = state?.scans ?? {};
  const items: AttentionItem[] = [];

  // --- Bugs + risks from scan findings ---
  const severeFindingsByProduct = new Map<string, Set<string>>();
  // Per (productId, ruleId) dedup so the same rule repeated across URLs on the
  // same product surfaces once in the feed (findings like "broken-links" appear
  // per URL but the actionable thing is the rule).
  const seenRule = new Set<string>();

  for (const p of products) {
    const scan = scans[p.id];
    if (!scan || !scan.ok) continue;
    const fails = scan.findings.filter((f) => f.status === "fail");
    const severe = new Set<string>();
    for (const f of fails) {
      if (f.severity === "CRITICAL" || f.severity === "HIGH") severe.add(f.ruleId);
    }
    severeFindingsByProduct.set(p.id, severe);

    for (const f of fails) {
      const ruleKey = `${p.id}:${f.ruleId}`;
      if (seenRule.has(ruleKey)) continue; // same finding kind once per product
      seenRule.add(ruleKey);
      const source = sourceFromSeverity(f.severity);
      const baseScore = findingBaseScore(f);
      const isBug = source === "BUG";
      items.push({
        id: f.stableKey || ruleKey,
        source,
        kind: isBug ? "BUG" : "RISK",
        productId: p.id,
        productName: p.name,
        title: f.title,
        description: f.detail,
        evidence: [f.detail],
        reasoning: isBug
          ? `This ${f.severity.toLowerCase()} severity site finding breaks a core experience (${f.title}). Because ${f.confidence.toLowerCase()}-confidence observation confirms it, it earns attention before optional improvements.`
          : `This ${f.severity.toLowerCase()} finding is a quality/confidence gap worth reviewing, not an emergency. ${f.confidence} confidence in the observation, so weight it against your capacity to act.`,
        recommendation: `Fix the ${f.title.toLowerCase()}.`,
        action: f.detail,
        baseScore,
        score: baseScore,
        confidence: f.confidence,
        severity: f.severity,
        attentionClass: attentionClassOf(baseScore),
        status: "open",
        finding: f,
        recType: isBug ? "bug" : "issue",
        scanKey: f.stableKey || ruleKey,
      });
    }
  }

  // --- Opportunities (Phase 3) ---
  const opps = rankOpportunities(computeOpportunities(state));
  const dropOpps = opportunityRuleDedup(opps, severeFindingsByProduct);
  for (const o of opps) {
    if (dropOpps.has(o.id)) continue; // its severe bug already represents it
    items.push({
      id: o.id,
      source: "OPPORTUNITY",
      kind: o.type,
      productId: o.productId,
      productName: o.productName,
      title: o.title,
      description: o.description,
      evidence: o.evidence,
      reasoning: `An evidence-backed improvement scored ${o.score}/100 (impact ${Math.round(
        o.impact * 100,
      )}% · evidence ${Math.round(o.evidenceScore * 100)}% · fit ${Math.round(
        o.fit * 100,
      )}% · ease ${Math.round(o.ease * 100)}%).`,
      recommendation: o.recommendation,
      action: o.action,
      baseScore: o.score,
      score: o.score,
      confidence: o.confidence,
      attentionClass: attentionClassOf(o.score),
      status: o.status as AttentionStatus,
      effortLabel: o.effortLabel,
      sourceOpp: o,
      recType: "feature",
      scanKey: o.id,
    });
  }

  // --- Market gaps (Phase 4) — portfolio level ---
  for (const g of rankMarketGaps(computeMarketGaps(state))) {
    items.push({
      id: g.id,
      source: "MARKET_GAP",
      kind: g.type,
      productId: PORTFOLIO_ID,
      productName: PORTFOLIO_NAME,
      title: g.title,
      description: g.description,
      evidence: g.evidence,
      reasoning: `A structural portfolio gap worth staging: ${g.sourceNote}. Competitors providing this: ${g.competitors.join(
        ", ",
      )}.`,
      recommendation: g.recommendation,
      action: g.action,
      baseScore: g.score,
      score: g.score,
      confidence: g.confidence,
      attentionClass: attentionClassOf(g.score),
      status: g.status as AttentionStatus,
      effortLabel: g.effortLabel,
      sourceOpp: g as Opportunity,
      recType: "feature",
      scanKey: g.id,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// buildAttention — compute → capacity-weight → personalize → filter → rank,
// and attach the "next window worth spending on" to the capacity output.
// ---------------------------------------------------------------------------
export function buildAttention(
  state: AppState,
  feedback: Record<string, FeedbackEntry> = state.feedback,
  opportunityFeedback: Record<string, FeedbackEntry> = state.opportunityFeedback,
): { items: AttentionItem[]; capacity: CapacitySignals } {
  const capacity = computeCapacity(state);
  let items = computeAttention(state);

  // Capacity-weight every item's score (opportunities scale with free capacity).
  items = items.map((it) => ({
    ...it,
    score: capacityWeightedScore(it, capacity.capacity),
  }));

  // Personalise from feedback, then hide de-prioritised sources.
  items = items.map((it) => ({
    ...it,
    score: personalizeScore(it, feedback, opportunityFeedback),
    attentionClass: attentionClassOf(
      personalizeScore(it, feedback, opportunityFeedback),
    ),
  }));
  items = applyAttentionFeedback(items, feedback, opportunityFeedback);

  items = rankAttention(items);

  // Next window worth spending on = highest marginal value-to-effort item now
  // (the top of the ranked, capacity-weighted feed — the single best use of the
  // next window of attention).
  if (items.length > 0) {
    capacity.nextWindowId = items[0].id;
    capacity.nextWindowLabel = `${items[0].productName} — ${items[0].title}`;
  }

  return { items, capacity };
}
