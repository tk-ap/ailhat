import {
  EXTERNAL_OBSERVATION_SCHEMA,
  normalizeExternalObservations,
  type EvidenceSourceDeclaration,
  type ExternalObservation,
  type ProductDeploymentIdentity,
} from "./external-evidence";

const API_ROOT = "https://api.vercel.com";
const DEFAULT_LIMIT = 10;

interface VercelDomainPayload {
  name?: string;
  verified?: boolean;
  projectId?: string;
}

interface VercelDomainsResponse {
  domains?: VercelDomainPayload[];
}

interface VercelDeploymentPayload {
  uid?: string;
  id?: string;
  name?: string;
  url?: string | null;
  state?: string;
  readyState?: string;
  target?: string | null;
  created?: number;
  createdAt?: number;
  ready?: number;
  buildingAt?: number;
  meta?: Record<string, unknown>;
}

interface VercelDeploymentsResponse {
  deployments?: VercelDeploymentPayload[];
}

export interface VercelDeploymentEvidenceResult {
  productId: string;
  deployment: ProductDeploymentIdentity;
  source: EvidenceSourceDeclaration;
  observations: ExternalObservation[];
  fetchedAt: number;
  availability: "connected" | "unavailable";
  reason?: string;
}

function productHost(productUrl: string): string | null {
  try {
    return new URL(productUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function querySuffix(teamId?: string): string {
  return teamId ? `&teamId=${encodeURIComponent(teamId)}` : "";
}

async function vercelJson<T>(
  fetchImpl: typeof fetch,
  token: string,
  path: string,
): Promise<{ ok: true; value: T } | { ok: false; status: number; reason: string }> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_ROOT}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "User-Agent": "ailhat-portfolio-intelligence",
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, reason: "Vercel could not be reached." };
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        status: response.status,
        reason:
          "Vercel authentication or scope does not allow this project observation. No deployment activity should be inferred from the missing result.",
      };
    }
    if (response.status === 404) {
      return {
        ok: false,
        status: response.status,
        reason:
          "Vercel project or domain mapping was not found in the configured account scope.",
      };
    }
    if (response.status === 429) {
      return {
        ok: false,
        status: response.status,
        reason:
          "Vercel rate limiting prevented this observation. Deployment state remains unknown.",
      };
    }
    return {
      ok: false,
      status: response.status,
      reason: `Vercel returned HTTP ${response.status}; deployment evidence remains unavailable.`,
    };
  }

  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, status: response.status, reason: "Vercel returned an unreadable response." };
  }
}

function mapDeploymentState(raw?: string): ExternalObservation["state"] {
  const state = (raw ?? "").toUpperCase();
  if (state === "READY") return "ready";
  if (state === "ERROR" || state === "CANCELED" || state === "BLOCKED") return "failed";
  if (state === "BUILDING" || state === "INITIALIZING" || state === "QUEUED") return "started";
  return "observed";
}

function deploymentObservation(
  productId: string,
  projectRef: string,
  row: VercelDeploymentPayload,
): ExternalObservation | null {
  const id = (row.uid ?? row.id ?? row.url ?? "").trim();
  if (!id) return null;
  const observedAt = row.ready ?? row.createdAt ?? row.created ?? row.buildingAt;
  if (typeof observedAt !== "number" || !Number.isFinite(observedAt) || observedAt <= 0) return null;
  const rawState = row.readyState ?? row.state;
  const state = mapDeploymentState(rawState);
  const meta = row.meta ?? {};
  const commitSha = typeof meta.githubCommitSha === "string" ? meta.githubCommitSha : undefined;
  const commitRef = typeof meta.githubCommitRef === "string" ? meta.githubCommitRef : undefined;
  const deploymentUrl = row.url ? `https://${row.url.replace(/^https?:\/\//, "")}` : undefined;

  return {
    schema: EXTERNAL_OBSERVATION_SCHEMA,
    id: `vercel:${projectRef}:deployment:${id}`,
    productId,
    provider: "vercel",
    kind: "deployment",
    state,
    observedAt,
    sourceRef: id,
    sourceUrl: deploymentUrl,
    summary: `Vercel ${row.target ?? "deployment"} ${state}${commitSha ? ` for ${commitSha.slice(0, 7)}` : ""}`,
    authoritativeFor: ["deployment_state"],
    confidence: "HIGH",
    metadata: {
      projectRef,
      ...(row.name ? { deploymentName: row.name } : {}),
      ...(row.target ? { target: row.target } : {}),
      ...(rawState ? { providerState: rawState } : {}),
      ...(commitSha ? { commitSha } : {}),
      ...(commitRef ? { commitRef } : {}),
    },
  };
}

export async function observeVercelProject(
  productId: string,
  productUrl: string,
  projectRef: string,
  token: string | undefined,
  teamId?: string,
  fetchImpl: typeof fetch = fetch,
  fetchedAt = Date.now(),
): Promise<VercelDeploymentEvidenceResult> {
  const host = productHost(productUrl);
  const cleanProjectRef = projectRef.trim();
  const cleanToken = token?.trim();
  const identity: ProductDeploymentIdentity = {
    provider: "vercel",
    projectRef: cleanProjectRef || "unknown",
    productionDomains: host ? [host] : [],
  };

  if (!host) {
    const reason = "The ailhat product does not have a valid production URL to validate against Vercel.";
    return {
      productId,
      deployment: identity,
      source: { provider: "vercel", availability: "unavailable", reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason,
    };
  }
  if (!cleanProjectRef) {
    const reason = "A Vercel project ID or name is required.";
    return {
      productId,
      deployment: identity,
      source: { provider: "vercel", availability: "unavailable", reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason,
    };
  }
  if (!cleanToken) {
    const reason =
      "The ailhat server does not have a Vercel read credential configured. Deployment state remains unknown; no inactivity is inferred.";
    return {
      productId,
      deployment: identity,
      source: { provider: "vercel", availability: "unavailable", reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason,
    };
  }

  const encodedProject = encodeURIComponent(cleanProjectRef);
  const domains = await vercelJson<VercelDomainsResponse>(
    fetchImpl,
    cleanToken,
    `/v9/projects/${encodedProject}/domains?production=true&limit=100${querySuffix(teamId)}`,
  );
  if (!domains.ok) {
    return {
      productId,
      deployment: identity,
      source: { provider: "vercel", availability: "unavailable", reason: domains.reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason: domains.reason,
    };
  }

  const productionDomains = (domains.value.domains ?? [])
    .map((domain) => domain.name?.toLowerCase())
    .filter((name): name is string => Boolean(name));
  if (!productionDomains.includes(host)) {
    const reason =
      "The requested Vercel project is not mapped to this product's production hostname in the configured Vercel account. No deployment details were returned.";
    return {
      productId,
      deployment: { ...identity, productionDomains },
      source: { provider: "vercel", availability: "unavailable", reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason,
    };
  }

  const deployments = await vercelJson<VercelDeploymentsResponse>(
    fetchImpl,
    cleanToken,
    `/v7/deployments?projectId=${encodedProject}&target=production&limit=${DEFAULT_LIMIT}${querySuffix(teamId)}`,
  );
  if (!deployments.ok) {
    return {
      productId,
      deployment: { ...identity, productionDomains },
      source: { provider: "vercel", availability: "unavailable", reason: deployments.reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason: deployments.reason,
    };
  }

  const observations = normalizeExternalObservations(
    (deployments.value.deployments ?? [])
      .map((deployment) => deploymentObservation(productId, cleanProjectRef, deployment))
      .filter((observation): observation is ExternalObservation => observation !== null),
  );

  return {
    productId,
    deployment: {
      provider: "vercel",
      projectRef: cleanProjectRef,
      productionDomains,
    },
    source: { provider: "vercel", availability: "connected" },
    observations,
    fetchedAt,
    availability: "connected",
  };
}
