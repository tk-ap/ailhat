export const RADAR_RECOMMENDATIONS = [
  "ABSORB",
  "EXTEND",
  "EXPERIMENT",
  "WATCH",
  "SPIN_OUT",
  "REJECT",
] as const;

export type RadarRecommendation = (typeof RADAR_RECOMMENDATIONS)[number];
export type ExternalSignalInputMode = "url" | "text" | "manual";
export type ExternalSignalStatus = "captured" | "triaged" | "archived";
export type SignalType = "opportunity" | "risk" | "trend" | "customer-pain" | "capability";

export interface ExternalSignal {
  id: string;
  input_mode: ExternalSignalInputMode;
  source: string;
  captured_at: number;
  signal_type: SignalType;
  problem: string;
  audience: string;
  evidence: string[];
  market_momentum: number;
  portfolio_adjacency: number;
  founder_fit: number;
  existing_leverage: number;
  execution_cost: number;
  strategic_risk: number;
  recommendation: RadarRecommendation;
  confidence: number;
  status: ExternalSignalStatus;
}

export interface ExternalSignalDraft {
  input_mode: ExternalSignalInputMode;
  source: string;
  signal_type: SignalType;
  problem: string;
  audience: string;
  evidence: string | string[];
  market_momentum: number;
  portfolio_adjacency: number;
  founder_fit: number;
  existing_leverage: number;
  execution_cost: number;
  strategic_risk: number;
}

const clamp = (value: number) => Math.max(0, Math.min(5, Math.round(value)));

export function recommendSignal(
  input: Pick<
    ExternalSignalDraft,
    | "market_momentum"
    | "portfolio_adjacency"
    | "founder_fit"
    | "existing_leverage"
    | "execution_cost"
    | "strategic_risk"
  >,
): { recommendation: RadarRecommendation; confidence: number } {
  const momentum = clamp(input.market_momentum);
  const adjacency = clamp(input.portfolio_adjacency);
  const fit = clamp(input.founder_fit);
  const leverage = clamp(input.existing_leverage);
  const cost = clamp(input.execution_cost);
  const risk = clamp(input.strategic_risk);
  const upside = momentum + adjacency + fit + leverage;
  const drag = cost + risk;

  let recommendation: RadarRecommendation;
  if (risk >= 5 || upside - drag <= 1) recommendation = "REJECT";
  else if (adjacency >= 4 && leverage >= 4) recommendation = "ABSORB";
  else if (adjacency >= 4 && fit >= 3) recommendation = "EXTEND";
  else if (momentum >= 4 && adjacency <= 2 && fit >= 3) recommendation = "SPIN_OUT";
  else if (upside - drag >= 7 && cost <= 3) recommendation = "EXPERIMENT";
  else recommendation = "WATCH";

  const evidenceStrength = [momentum, adjacency, fit, leverage, cost, risk].filter(
    (value) => value !== 3,
  ).length;
  const confidence = Math.min(95, 45 + evidenceStrength * 8);
  return { recommendation, confidence };
}

export function normalizeExternalSignal(
  draft: ExternalSignalDraft,
  now = Date.now(),
): ExternalSignal {
  const metrics = {
    market_momentum: clamp(draft.market_momentum),
    portfolio_adjacency: clamp(draft.portfolio_adjacency),
    founder_fit: clamp(draft.founder_fit),
    existing_leverage: clamp(draft.existing_leverage),
    execution_cost: clamp(draft.execution_cost),
    strategic_risk: clamp(draft.strategic_risk),
  };
  const evidence = (Array.isArray(draft.evidence) ? draft.evidence : draft.evidence.split("\n"))
    .map((item) => item.trim())
    .filter(Boolean);
  const assessment = recommendSignal(metrics);

  return {
    id: `radar-${now}-${Math.random().toString(36).slice(2, 8)}`,
    input_mode: draft.input_mode,
    source: draft.source.trim() || "Manual capture",
    captured_at: now,
    signal_type: draft.signal_type,
    problem: draft.problem.trim(),
    audience: draft.audience.trim(),
    evidence,
    ...metrics,
    ...assessment,
    status: "triaged",
  };
}

