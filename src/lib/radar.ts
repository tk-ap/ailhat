export const RADAR_DISPOSITIONS = ["ABSORB", "EXTEND", "EXPERIMENT", "WATCH", "SPIN_OUT", "REJECT"] as const;
export type RadarDisposition = (typeof RADAR_DISPOSITIONS)[number];
export type RadarInputMode = "url" | "text" | "manual";
export type RadarSignalType = "opportunity" | "risk" | "trend" | "customer-pain" | "capability";
export type RadarSignalStatus = "active" | "archived";

export interface RadarScores {
  marketMomentum: number;
  portfolioAdjacency: number;
  founderFit: number;
  existingLeverage: number;
  executionCost: number;
  strategicRisk: number;
}

export interface RadarSignal extends RadarScores {
  id: string;
  inputMode: RadarInputMode;
  source: string;
  sourceUrl?: string;
  signalType: RadarSignalType;
  problem: string;
  audience: string;
  evidence: string[];
  productId?: string;
  computedDisposition: RadarDisposition;
  ownerDisposition?: RadarDisposition;
  score: number;
  status: RadarSignalStatus;
  createdAt: number;
  updatedAt: number;
}

export interface RadarDraft extends RadarScores {
  inputMode: RadarInputMode;
  source: string;
  sourceUrl?: string;
  signalType: RadarSignalType;
  problem: string;
  audience: string;
  evidence: string | string[];
  productId?: string;
}

const clamp = (n: number) => Math.max(0, Math.min(5, Number.isFinite(n) ? n : 0));

export function scoreRadarSignal(scores: RadarScores): number {
  const positive =
    clamp(scores.marketMomentum) * 0.2 +
    clamp(scores.portfolioAdjacency) * 0.25 +
    clamp(scores.founderFit) * 0.15 +
    clamp(scores.existingLeverage) * 0.2;
  const restraint =
    (5 - clamp(scores.executionCost)) * 0.1 +
    (5 - clamp(scores.strategicRisk)) * 0.1;
  return Math.round(((positive + restraint) / 5) * 100);
}

export function recommendRadarSignal(scores: RadarScores): RadarDisposition {
  const score = scoreRadarSignal(scores);
  if (scores.strategicRisk >= 4 && scores.existingLeverage <= 2) return "REJECT";
  if (scores.portfolioAdjacency >= 4 && scores.existingLeverage >= 4 && scores.executionCost <= 3) return "ABSORB";
  if (scores.portfolioAdjacency >= 4 && scores.existingLeverage >= 3) return "EXTEND";
  if (scores.portfolioAdjacency <= 2 && scores.marketMomentum >= 4 && scores.founderFit >= 4 && score >= 70) return "SPIN_OUT";
  if (scores.marketMomentum >= 4 && scores.founderFit >= 3 && score >= 60) return "EXPERIMENT";
  if (score < 40) return "REJECT";
  return "WATCH";
}

export function normalizeRadarDraft(draft: RadarDraft, now = Date.now()): RadarSignal {
  const scores: RadarScores = {
    marketMomentum: clamp(Number(draft.marketMomentum)),
    portfolioAdjacency: clamp(Number(draft.portfolioAdjacency)),
    founderFit: clamp(Number(draft.founderFit)),
    existingLeverage: clamp(Number(draft.existingLeverage)),
    executionCost: clamp(Number(draft.executionCost)),
    strategicRisk: clamp(Number(draft.strategicRisk)),
  };
  const evidence = (Array.isArray(draft.evidence) ? draft.evidence : String(draft.evidence ?? "").split(/\r?\n/))
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
  const source = String(draft.source ?? "").trim();
  const problem = String(draft.problem ?? "").trim();
  const audience = String(draft.audience ?? "").trim();
  if (!source || !problem || !audience) throw new Error("source_problem_audience_required");
  return {
    id: `radar:${now}:${Math.random().toString(36).slice(2, 8)}`,
    inputMode: draft.inputMode,
    source,
    ...(draft.sourceUrl?.trim() ? { sourceUrl: draft.sourceUrl.trim() } : {}),
    signalType: draft.signalType,
    problem,
    audience,
    evidence,
    ...(draft.productId?.trim() ? { productId: draft.productId.trim() } : {}),
    ...scores,
    computedDisposition: recommendRadarSignal(scores),
    score: scoreRadarSignal(scores),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export function effectiveRadarDisposition(signal: RadarSignal): RadarDisposition {
  return signal.ownerDisposition ?? signal.computedDisposition;
}
