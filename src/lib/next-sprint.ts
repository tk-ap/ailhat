import type { AppState } from "./store";
import { buildAttention, type AttentionItem } from "./attention";

export const NEXT_SPRINT_SCHEMA = "ailhat.next-sprint/v1" as const;

export interface SprintRecommendation {
  sourceId: string;
  rank: number;
  title: string;
  outcome: string;
  whyNow: string;
  product: {
    id: string;
    name: string;
    repository: string | null;
  };
  evidence: string[];
  dependencies: string[];
  blockers: string[];
  acceptanceCriteria: string[];
  verification: string;
  confidence: string;
  score: number;
  freshness: "current-portfolio-state";
}

export interface NextSprintRecommendation {
  schema: typeof NEXT_SPRINT_SCHEMA;
  generatedAt: string;
  source: "ailhat Portfolio Intelligence";
  advisory: true;
  itemCount: number;
  recommendations: SprintRecommendation[];
}

function outcome(item: AttentionItem): string {
  return item.recommendation || item.action || item.title;
}

function whyNow(item: AttentionItem): string {
  const classReason =
    item.attentionClass === "ACT_NOW"
      ? "ailhat classifies this as requiring immediate attention."
      : item.attentionClass === "REVIEW"
        ? "ailhat ranks this in the current review window."
        : "ailhat ranks this as a current portfolio opportunity.";
  return `${classReason} ${item.reasoning}`;
}

function acceptance(item: AttentionItem): string[] {
  const criteria = [
    `The intended outcome is achieved: ${outcome(item)}`,
    "The change does not introduce a blocking regression in the affected product path.",
    "Execution evidence is recorded in the canonical work system.",
  ];
  if (item.source === "BUG" || item.source === "RISK") {
    criteria.push("Re-run the supporting observation/scan and confirm the reported condition no longer reproduces.");
  } else {
    criteria.push("Verify the improvement against the evidence that caused ailhat to recommend it.");
  }
  return criteria;
}

function verification(item: AttentionItem): string {
  if (item.source === "BUG" || item.source === "RISK") {
    return "Independent verification must reproduce the relevant path and re-run the supporting observation/scan where available.";
  }
  return "Independent verification must compare the delivered result with the cited portfolio evidence and intended outcome.";
}

export function selectSprintItems(items: AttentionItem[], limit = 5): AttentionItem[] {
  return items
    .filter((item) => item.status === "open" || item.status === "investigating")
    .slice(0, Math.max(0, limit));
}

function repositoryFor(state: AppState, productId: string): string | null {
  const product = state.products.find((candidate) => candidate.id === productId);
  const value = product?.repository?.trim();
  return value || null;
}

export function buildSprintRecommendations(
  state: AppState,
  selected: AttentionItem[],
): SprintRecommendation[] {
  return selected.map((item, index) => ({
    sourceId: item.id,
    rank: index + 1,
    title: item.title,
    outcome: outcome(item),
    whyNow: whyNow(item),
    product: {
      id: item.productId,
      name: item.productName,
      repository: repositoryFor(state, item.productId),
    },
    evidence: [...item.evidence],
    dependencies: [],
    blockers: [],
    acceptanceCriteria: acceptance(item),
    verification: verification(item),
    confidence: item.confidence,
    score: item.score,
    freshness: "current-portfolio-state",
  }));
}

export function computeNextSprint(
  state: AppState,
  generatedAtMs = Date.now(),
  limit = 5,
): NextSprintRecommendation {
  if ((state.products ?? []).length === 0) {
    return {
      schema: NEXT_SPRINT_SCHEMA,
      generatedAt: new Date(generatedAtMs).toISOString(),
      source: "ailhat Portfolio Intelligence",
      advisory: true,
      itemCount: 0,
      recommendations: [],
    };
  }

  const { items } = buildAttention(state);
  const selected = selectSprintItems(items, limit);
  const recommendations = buildSprintRecommendations(state, selected);

  return {
    schema: NEXT_SPRINT_SCHEMA,
    generatedAt: new Date(generatedAtMs).toISOString(),
    source: "ailhat Portfolio Intelligence",
    advisory: true,
    itemCount: recommendations.length,
    recommendations,
  };
}
