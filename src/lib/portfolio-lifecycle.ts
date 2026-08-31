// Evidence-safe portfolio lifecycle assessment.
//
// The goal is to protect the user's attention without erasing history. ailhat may
// recommend that an inactive product be retired from active planning, but it must
// never infer failure from silence alone and it must never auto-retire.

import type {
  AppState,
  Product,
  ProductEngagementEvidence,
} from "./store";

const DAY = 24 * 60 * 60 * 1000;

// Tunable defaults. The recommendation threshold is intentionally more
// conservative than the review threshold.
export const RETIRE_REVIEW_DAYS = 30;
export const RETIRE_RECOMMEND_DAYS = 60;
export const OBSERVATION_FRESH_DAYS = 7;
export const ENGAGEMENT_FRESH_DAYS = 35;

export type RetirementAction = "none" | "review" | "recommend_retire";

export interface RetirementAssessment {
  productId: string;
  productName: string;
  action: RetirementAction;
  quietDays?: number;
  observationAgeDays?: number;
  engagementAgeDays?: number;
  engagementLevel?: ProductEngagementEvidence["level"];
  evidence: string[];
  reasoning: string;
}

function daysSince(at: number | undefined, now: number): number | undefined {
  if (!at) return undefined;
  return Math.max(0, Math.floor((now - at) / DAY));
}

function engagementLine(e: ProductEngagementEvidence, ageDays: number): string {
  const trend = e.trend && e.trend !== "unknown" ? ` · trend ${e.trend}` : "";
  const summary = e.summary ? ` · ${e.summary}` : "";
  return `Engagement ${e.level} · ${e.source} · ${e.windowDays}d window · observed ${ageDays}d ago${trend}${summary}`;
}

/**
 * Assess one ACTIVE product. Retired products do not participate because they
 * are stored outside `state.products`.
 *
 * Recommendation discipline:
 * - no auto-retirement;
 * - no retirement recommendation from inactivity alone;
 * - site observation must be fresh enough to support a current claim;
 * - engagement evidence must be fresh and classify activity as low/none;
 * - "no observed site changes" refers only to ailhat-observable scan signals.
 */
export function assessProductRetirement(
  state: AppState,
  product: Product,
  now = Date.now(),
): RetirementAssessment {
  const activity = (state.productActivity ?? {})[product.id];
  const engagement = (state.engagement ?? {})[product.id];
  const evidence: string[] = [];

  if (!activity?.firstObservedAt || !activity.lastObservedAt) {
    return {
      productId: product.id,
      productName: product.name,
      action: "none",
      evidence: ["Not enough site-observation history to assess inactivity."],
      reasoning:
        "ailhat should observe the product over time before making a lifecycle recommendation.",
    };
  }

  const observationAgeDays = daysSince(activity.lastObservedAt, now) ?? 0;
  const observationSpanDays = Math.max(
    0,
    Math.floor((activity.lastObservedAt - activity.firstObservedAt) / DAY),
  );

  // A single observation is not evidence that a site has stayed unchanged.
  if (observationSpanDays < 1) {
    return {
      productId: product.id,
      productName: product.name,
      action: "none",
      observationAgeDays,
      evidence: ["Only one observation point is available so far."],
      reasoning:
        "A retirement prompt needs repeated observations, not a single snapshot.",
    };
  }

  const quietSince =
    activity.lastObservedSiteChangeAt ?? activity.firstObservedAt;
  const quietDays = daysSince(quietSince, now) ?? 0;
  evidence.push(
    `No material change in ailhat-observable site signals for about ${quietDays} day${quietDays === 1 ? "" : "s"}.`,
  );

  // If the last observation itself is stale, refresh the evidence before making
  // any lifecycle recommendation.
  if (observationAgeDays > OBSERVATION_FRESH_DAYS) {
    return {
      productId: product.id,
      productName: product.name,
      action: quietDays >= RETIRE_REVIEW_DAYS ? "review" : "none",
      quietDays,
      observationAgeDays,
      evidence: [
        ...evidence,
        `Latest site observation is ${observationAgeDays} days old; refresh before deciding.`,
      ],
      reasoning:
        quietDays >= RETIRE_REVIEW_DAYS
          ? "The product looks quiet, but the current site evidence is stale. Review it rather than retiring from stale data."
          : "The observation evidence is not fresh enough for a lifecycle decision.",
    };
  }

  if (quietDays < RETIRE_REVIEW_DAYS) {
    return {
      productId: product.id,
      productName: product.name,
      action: "none",
      quietDays,
      observationAgeDays,
      evidence,
      reasoning: "Recent observed change keeps this product in the active planning set.",
    };
  }

  if (!engagement) {
    return {
      productId: product.id,
      productName: product.name,
      action: "review",
      quietDays,
      observationAgeDays,
      evidence: [
        ...evidence,
        "Traffic/engagement evidence is not connected, so inactivity alone is not enough to recommend retirement.",
      ],
      reasoning:
        "Review whether this product is still strategically active. ailhat should not recommend retirement until engagement evidence corroborates the inactivity signal.",
    };
  }

  const engagementAgeDays = daysSince(engagement.observedAt, now) ?? 0;
  evidence.push(engagementLine(engagement, engagementAgeDays));

  if (engagementAgeDays > ENGAGEMENT_FRESH_DAYS) {
    return {
      productId: product.id,
      productName: product.name,
      action: "review",
      quietDays,
      observationAgeDays,
      engagementAgeDays,
      engagementLevel: engagement.level,
      evidence: [
        ...evidence,
        "Engagement evidence is too old to support a retirement recommendation.",
      ],
      reasoning:
        "The product is quiet, but engagement should be refreshed before changing its lifecycle state.",
    };
  }

  if (engagement.level === "healthy") {
    return {
      productId: product.id,
      productName: product.name,
      action: "none",
      quietDays,
      observationAgeDays,
      engagementAgeDays,
      engagementLevel: engagement.level,
      evidence,
      reasoning:
        "The product may be operationally quiet, but current engagement supports keeping it active in the portfolio.",
    };
  }

  if (
    quietDays >= RETIRE_RECOMMEND_DAYS &&
    (engagement.level === "low" || engagement.level === "none")
  ) {
    return {
      productId: product.id,
      productName: product.name,
      action: "recommend_retire",
      quietDays,
      observationAgeDays,
      engagementAgeDays,
      engagementLevel: engagement.level,
      evidence,
      reasoning:
        "Both independent signals point the same way: the product has stayed unchanged in observable site signals and current engagement is low/absent. Retiring it would preserve context while removing it from active planning.",
    };
  }

  return {
    productId: product.id,
    productName: product.name,
    action: "review",
    quietDays,
    observationAgeDays,
    engagementAgeDays,
    engagementLevel: engagement.level,
    evidence,
    reasoning:
      "The product is quiet enough to review, but the evidence is not yet strong enough for ailhat to recommend retirement.",
  };
}

export function assessPortfolioRetirement(
  state: AppState,
  now = Date.now(),
): RetirementAssessment[] {
  return (state.products ?? []).map((p) => assessProductRetirement(state, p, now));
}

export function retirementRecommendationCount(state: AppState, now = Date.now()): number {
  return assessPortfolioRetirement(state, now).filter(
    (a) => a.action === "recommend_retire",
  ).length;
}
