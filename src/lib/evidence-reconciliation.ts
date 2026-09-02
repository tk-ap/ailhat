import {
  buildEvidenceSourceStates,
  isExternalChangeEvidence,
  normalizeExternalObservations,
  type EvidenceSourceDeclaration,
  type ExternalObservation,
} from "./external-evidence";
import type { ProductScanHistory } from "./observation";

export type ProductEvidenceReconciliationState =
  | "unknown"
  | "observed_no_change"
  | "external_change_observed"
  | "verification_pending"
  | "verified_current"
  | "persisting_after_change";

export interface ReleaseChain {
  commitSha: string;
  repositoryObservationIds: string[];
  deploymentObservationIds: string[];
  latestObservedAt: number;
}

export interface ProductEvidenceReconciliation {
  productId: string;
  state: ProductEvidenceReconciliationState;
  latestProductionScanAt: number | null;
  latestExternalObservedAt: number | null;
  latestExternalChangeAt: number | null;
  activeFindingCount: number;
  activeFindingKeys: string[];
  externalObservationIds: string[];
  sourceStates: ReturnType<typeof buildEvidenceSourceStates>;
  releaseChains: ReleaseChain[];
  verificationRecommended: boolean;
  canClaimCurrentProductionClean: boolean;
  reason: string;
  recommendedAction: string;
}

function metadataString(
  observation: ExternalObservation,
  key: string,
): string | null {
  const value = observation.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function repositoryShas(observation: ExternalObservation): string[] {
  if (observation.provider !== "github") return [];
  const values = [
    metadataString(observation, "sha"),
    metadataString(observation, "headSha"),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}

function deploymentSha(observation: ExternalObservation): string | null {
  if (observation.provider !== "vercel" || observation.state !== "ready") {
    return null;
  }
  return metadataString(observation, "commitSha");
}

export function buildReleaseChains(
  observations: ExternalObservation[],
): ReleaseChain[] {
  const normalized = normalizeExternalObservations(observations);
  const repositoryBySha = new Map<string, ExternalObservation[]>();

  for (const observation of normalized) {
    for (const sha of repositoryShas(observation)) {
      const current = repositoryBySha.get(sha) ?? [];
      current.push(observation);
      repositoryBySha.set(sha, current);
    }
  }

  const deploymentsBySha = new Map<string, ExternalObservation[]>();
  for (const observation of normalized) {
    const sha = deploymentSha(observation);
    if (!sha) continue;
    const current = deploymentsBySha.get(sha) ?? [];
    current.push(observation);
    deploymentsBySha.set(sha, current);
  }

  const chains: ReleaseChain[] = [];
  for (const [sha, deployments] of deploymentsBySha) {
    const repository = repositoryBySha.get(sha) ?? [];
    if (repository.length === 0) continue;
    chains.push({
      commitSha: sha,
      repositoryObservationIds: repository.map((row) => row.id),
      deploymentObservationIds: deployments.map((row) => row.id),
      latestObservedAt: Math.max(
        ...repository.map((row) => row.observedAt),
        ...deployments.map((row) => row.observedAt),
      ),
    });
  }

  return chains.sort((a, b) => b.latestObservedAt - a.latestObservedAt);
}

export interface ReconcileProductEvidenceInput {
  productId: string;
  observations: ExternalObservation[];
  sources?: EvidenceSourceDeclaration[];
  scanHistory?: ProductScanHistory | null;
}

/**
 * Reconcile outside work/release evidence with production observation.
 *
 * This works at product scope on purpose: without an explicit relation between
 * a PR/deployment and a specific finding, ailhat may recommend a fresh product
 * verification but must not pretend that every outside change fixes every finding.
 */
export function reconcileProductEvidence(
  input: ReconcileProductEvidenceInput,
): ProductEvidenceReconciliation {
  const observations = normalizeExternalObservations(
    input.observations.filter((row) => row.productId === input.productId),
  );
  const sourceStates = buildEvidenceSourceStates(observations, input.sources ?? []);
  const scanHistory = input.scanHistory ?? null;
  const latestProductionScanAt = scanHistory?.lastGood?.scannedAt ?? null;
  const activeIssues = Object.values(scanHistory?.issues ?? {}).filter(
    (issue) => issue.present,
  );
  const activeFindingKeys = activeIssues.map((issue) => issue.stableKey);
  const activeFindingCount = activeIssues.length;
  const changeObservations = observations.filter(isExternalChangeEvidence);
  const latestExternalObservedAt = observations[0]?.observedAt ?? null;
  const latestExternalChangeAt = changeObservations.length
    ? Math.max(...changeObservations.map((row) => row.observedAt))
    : null;
  const releaseChains = buildReleaseChains(observations);

  const base = {
    productId: input.productId,
    latestProductionScanAt,
    latestExternalObservedAt,
    latestExternalChangeAt,
    activeFindingCount,
    activeFindingKeys,
    externalObservationIds: observations.map((row) => row.id),
    sourceStates,
    releaseChains,
  };

  if (observations.length === 0) {
    return {
      ...base,
      state: "unknown",
      verificationRecommended: false,
      canClaimCurrentProductionClean: activeFindingCount === 0 && latestProductionScanAt !== null,
      reason:
        "No external evidence is available for this product. Repository/deployment activity remains unknown rather than being interpreted as absent.",
      recommendedAction:
        "Connect or refresh an external evidence source when outside implementation/release context would improve this decision.",
    };
  }

  if (latestExternalChangeAt === null) {
    return {
      ...base,
      state: "observed_no_change",
      verificationRecommended: false,
      canClaimCurrentProductionClean: activeFindingCount === 0 && latestProductionScanAt !== null,
      reason:
        "External sources were observed, but this snapshot contains no successful work/release event that should trigger production verification.",
      recommendedAction:
        "Keep the current production evidence and refresh external sources when new work or a release occurs.",
    };
  }

  if (latestProductionScanAt === null) {
    return {
      ...base,
      state: "verification_pending",
      verificationRecommended: true,
      canClaimCurrentProductionClean: false,
      reason:
        "External work or release evidence exists, but ailhat has no successful production scan to compare against it.",
      recommendedAction: "Verify production now before interpreting the outside change as resolved or regressed.",
    };
  }

  if (latestExternalChangeAt > latestProductionScanAt) {
    return {
      ...base,
      state: "verification_pending",
      verificationRecommended: true,
      canClaimCurrentProductionClean: false,
      reason:
        releaseChains.length > 0
          ? "Repository and Vercel evidence show a release chain newer than the last production scan. The release is acknowledged; its product effect is not verified yet."
          : "External work/release evidence is newer than the last production scan. ailhat acknowledges the change without assuming which findings it affected.",
      recommendedAction: "Verify production now and reconcile the fresh scan against the existing finding history.",
    };
  }

  if (activeFindingCount > 0) {
    return {
      ...base,
      state: "persisting_after_change",
      verificationRecommended: false,
      canClaimCurrentProductionClean: false,
      reason:
        `Production was scanned after the latest outside change and still has ${activeFindingCount} active finding${activeFindingCount === 1 ? "" : "s"}. The change shipped or occurred, but current production evidence still reproduces unresolved conditions.`,
      recommendedAction:
        "Review the persisting production findings. Do not re-run the same implementation work unless evidence links it to one of these remaining conditions.",
    };
  }

  return {
    ...base,
    state: "verified_current",
    verificationRecommended: false,
    canClaimCurrentProductionClean: true,
    reason:
      "A successful production scan is newer than the latest external change and no tracked scan finding remains active. ailhat may describe current production as clean for the checks it can verify, without claiming broader product success.",
    recommendedAction:
      "Retain the external work/release evidence and the production verification together as the current product-state record.",
  };
}
