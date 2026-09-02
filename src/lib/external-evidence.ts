export const EXTERNAL_OBSERVATION_SCHEMA = "ailhat.external-observation/v1" as const;

export type EvidenceProvider =
  | "github"
  | "vercel"
  | "agent-os"
  | "agent-direct"
  | "manual"
  | "other";

export type ExternalObservationKind =
  | "commit"
  | "pull_request"
  | "issue"
  | "deployment"
  | "execution"
  | "decision"
  | "engagement";

export type ExternalObservationState =
  | "observed"
  | "started"
  | "merged"
  | "deployed"
  | "ready"
  | "failed"
  | "completed"
  | "superseded";

export type EvidenceConfidence = "HIGH" | "MEDIUM" | "LOW";

export type EvidenceAuthorityScope =
  | "repository_activity"
  | "repository_merge"
  | "issue_state"
  | "deployment_state"
  | "execution_state"
  | "decision_state"
  | "engagement_state"
  | "user_assertion";

export interface ExternalObservation {
  schema: typeof EXTERNAL_OBSERVATION_SCHEMA;
  id: string;
  productId: string;
  provider: EvidenceProvider;
  kind: ExternalObservationKind;
  state: ExternalObservationState;
  observedAt: number;
  sourceRef?: string;
  sourceUrl?: string;
  summary: string;
  authoritativeFor: EvidenceAuthorityScope[];
  confidence: EvidenceConfidence;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ProductRepositoryIdentity {
  provider: "github" | "gitlab" | "other";
  owner?: string;
  name: string;
  url: string;
  defaultBranch?: string;
}

export interface ProductDeploymentIdentity {
  provider: "vercel" | "cloudflare" | "netlify" | "railway" | "render" | "other";
  projectRef: string;
  productionDomains?: string[];
}

export interface ProductWorkspaceIdentity {
  provider: "agent-os" | "agent-direct" | "other";
  ref: string;
}

export interface ProductEvidenceIdentity {
  productId: string;
  publicUrls: string[];
  repositories: ProductRepositoryIdentity[];
  deployments: ProductDeploymentIdentity[];
  workspaces: ProductWorkspaceIdentity[];
}

export type EvidenceSourceAvailability = "connected" | "unknown" | "unavailable";

export interface EvidenceSourceDeclaration {
  provider: EvidenceProvider;
  availability: EvidenceSourceAvailability;
  reason?: string;
}

export interface EvidenceSourceState extends EvidenceSourceDeclaration {
  observationCount: number;
  lastObservedAt: number | null;
}

export type ExternalEvidenceAssessmentState =
  | "unknown"
  | "observed_no_change"
  | "external_change_observed"
  | "verification_pending";

export interface ExternalEvidenceAssessment {
  productId: string;
  state: ExternalEvidenceAssessmentState;
  observationIds: string[];
  changeObservationIds: string[];
  latestObservedAt: number | null;
  sourceStates: EvidenceSourceState[];
  verificationPending: boolean;
  canClaimResolved: false;
  reason: string;
}

const PROVIDERS = new Set<EvidenceProvider>([
  "github",
  "vercel",
  "agent-os",
  "agent-direct",
  "manual",
  "other",
]);

const KINDS = new Set<ExternalObservationKind>([
  "commit",
  "pull_request",
  "issue",
  "deployment",
  "execution",
  "decision",
  "engagement",
]);

const STATES = new Set<ExternalObservationState>([
  "observed",
  "started",
  "merged",
  "deployed",
  "ready",
  "failed",
  "completed",
  "superseded",
]);

const CONFIDENCE = new Set<EvidenceConfidence>(["HIGH", "MEDIUM", "LOW"]);

const AUTHORITY = new Set<EvidenceAuthorityScope>([
  "repository_activity",
  "repository_merge",
  "issue_state",
  "deployment_state",
  "execution_state",
  "decision_state",
  "engagement_state",
  "user_assertion",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cleanMetadata(value: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!isObject(value)) return undefined;
  const next: Record<string, string | number | boolean | null> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (
      typeof raw === "string" ||
      typeof raw === "number" ||
      typeof raw === "boolean" ||
      raw === null
    ) {
      next[key] = raw;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Defensively normalize provider observations before they can influence
 * Portfolio Intelligence. Invalid rows are dropped rather than guessed.
 */
export function sanitizeExternalObservation(raw: unknown): ExternalObservation | null {
  if (!isObject(raw)) return null;

  const id = cleanString(raw.id);
  const productId = cleanString(raw.productId);
  const summary = cleanString(raw.summary);
  const provider = raw.provider;
  const kind = raw.kind;
  const state = raw.state;
  const confidence = raw.confidence;
  const observedAt = raw.observedAt;

  if (!id || !productId || !summary) return null;
  if (typeof provider !== "string" || !PROVIDERS.has(provider as EvidenceProvider)) return null;
  if (typeof kind !== "string" || !KINDS.has(kind as ExternalObservationKind)) return null;
  if (typeof state !== "string" || !STATES.has(state as ExternalObservationState)) return null;
  if (typeof confidence !== "string" || !CONFIDENCE.has(confidence as EvidenceConfidence)) return null;
  if (typeof observedAt !== "number" || !Number.isFinite(observedAt) || observedAt <= 0) return null;

  const rawAuthority = Array.isArray(raw.authoritativeFor) ? raw.authoritativeFor : [];
  const authoritativeFor = rawAuthority.filter(
    (value): value is EvidenceAuthorityScope =>
      typeof value === "string" && AUTHORITY.has(value as EvidenceAuthorityScope),
  );

  if (authoritativeFor.length === 0) return null;

  return {
    schema: EXTERNAL_OBSERVATION_SCHEMA,
    id,
    productId,
    provider: provider as EvidenceProvider,
    kind: kind as ExternalObservationKind,
    state: state as ExternalObservationState,
    observedAt,
    sourceRef: cleanString(raw.sourceRef),
    sourceUrl: cleanString(raw.sourceUrl),
    summary,
    authoritativeFor: [...new Set(authoritativeFor)],
    confidence: confidence as EvidenceConfidence,
    metadata: cleanMetadata(raw.metadata),
  };
}

export function createProductEvidenceIdentity(
  productId: string,
  publicUrls: string[] = [],
): ProductEvidenceIdentity {
  return {
    productId,
    publicUrls: [...new Set(publicUrls.filter(Boolean))],
    repositories: [],
    deployments: [],
    workspaces: [],
  };
}

/** Keep the newest observation for a stable id and sort newest-first. */
export function normalizeExternalObservations(
  observations: ExternalObservation[],
): ExternalObservation[] {
  const byId = new Map<string, ExternalObservation>();
  for (const observation of observations) {
    const current = byId.get(observation.id);
    if (!current || observation.observedAt > current.observedAt) {
      byId.set(observation.id, observation);
    }
  }
  return [...byId.values()].sort((a, b) => b.observedAt - a.observedAt);
}

/**
 * Evidence that meaningful work/change occurred outside ailhat. This is still
 * not evidence that the original user-facing condition is resolved.
 */
export function isExternalChangeEvidence(observation: ExternalObservation): boolean {
  if (observation.state === "failed") return false;
  if (observation.kind === "commit" && observation.state === "observed") return true;
  return (
    observation.state === "merged" ||
    observation.state === "deployed" ||
    observation.state === "ready" ||
    observation.state === "completed" ||
    observation.state === "superseded"
  );
}

export function buildEvidenceSourceStates(
  observations: ExternalObservation[],
  declarations: EvidenceSourceDeclaration[] = [],
): EvidenceSourceState[] {
  const normalized = normalizeExternalObservations(observations);
  const providers = new Set<EvidenceProvider>(declarations.map((source) => source.provider));
  normalized.forEach((observation) => providers.add(observation.provider));

  return [...providers].map((provider) => {
    const providerObservations = normalized.filter((observation) => observation.provider === provider);
    const declaration = declarations.find((source) => source.provider === provider);
    return {
      provider,
      // Actual observations establish that the source is available for this snapshot.
      availability: providerObservations.length > 0 ? "connected" : declaration?.availability ?? "unknown",
      reason: declaration?.reason,
      observationCount: providerObservations.length,
      lastObservedAt: providerObservations[0]?.observedAt ?? null,
    };
  });
}

export interface AssessExternalEvidenceInput {
  productId: string;
  observations: ExternalObservation[];
  sources?: EvidenceSourceDeclaration[];
  /** Timestamp of the condition/finding that external evidence might affect. */
  conditionObservedAt?: number | null;
}

/**
 * Summarize external evidence without promoting work/release evidence into
 * verified resolution. When a relevant external change is newer than the
 * condition being evaluated, the correct state is verification_pending.
 */
export function assessExternalEvidence(
  input: AssessExternalEvidenceInput,
): ExternalEvidenceAssessment {
  const observations = normalizeExternalObservations(
    input.observations.filter((observation) => observation.productId === input.productId),
  );
  const sourceStates = buildEvidenceSourceStates(observations, input.sources ?? []);
  const changeObservations = observations.filter(isExternalChangeEvidence);
  const latestObservedAt = observations[0]?.observedAt ?? null;
  const changeObservationIds = changeObservations.map((observation) => observation.id);

  if (observations.length === 0) {
    return {
      productId: input.productId,
      state: "unknown",
      observationIds: [],
      changeObservationIds: [],
      latestObservedAt: null,
      sourceStates,
      verificationPending: false,
      canClaimResolved: false,
      reason:
        "No external observation is available for this product. Missing or unconnected sources remain unknown rather than being interpreted as no activity.",
    };
  }

  if (changeObservations.length === 0) {
    return {
      productId: input.productId,
      state: "observed_no_change",
      observationIds: observations.map((observation) => observation.id),
      changeObservationIds: [],
      latestObservedAt,
      sourceStates,
      verificationPending: false,
      canClaimResolved: false,
      reason:
        "External evidence is available, but this snapshot does not contain authoritative evidence that relevant work or a release changed.",
    };
  }

  const newerThanCondition =
    typeof input.conditionObservedAt === "number" &&
    changeObservations.some((observation) => observation.observedAt >= input.conditionObservedAt!);

  if (newerThanCondition) {
    return {
      productId: input.productId,
      state: "verification_pending",
      observationIds: observations.map((observation) => observation.id),
      changeObservationIds,
      latestObservedAt,
      sourceStates,
      verificationPending: true,
      canClaimResolved: false,
      reason:
        "External change evidence is newer than the condition being evaluated. Work/release activity is acknowledged, but the original condition still requires verification before it can be retired as resolved.",
    };
  }

  return {
    productId: input.productId,
    state: "external_change_observed",
    observationIds: observations.map((observation) => observation.id),
    changeObservationIds,
    latestObservedAt,
    sourceStates,
    verificationPending: false,
    canClaimResolved: false,
    reason:
      "External evidence shows meaningful work or release activity. Without a linked condition timestamp and verification result, ailhat may acknowledge the change but cannot claim resolution.",
  };
}
