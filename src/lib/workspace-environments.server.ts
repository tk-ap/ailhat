export interface WorkspaceSandboxEnvironment {
  id: string;
  productKey: string;
  provider: string;
  purpose: string;
  environmentKind: string;
  url: string;
  providerSiteId: string | null;
  providerVersionId: string | null;
  sourceRepo: string | null;
  sourceRef: string | null;
  accessMode: string;
  ownership: string;
  persistence: string;
  status: string;
  expiresAt: string | null;
  lastObservedAt: string | null;
  metadata: Record<string, unknown>;
}

export interface WorkspaceEnvironmentProjection {
  available: boolean;
  source: string;
  observedAt: string | null;
  error: string | null;
  environments: WorkspaceSandboxEnvironment[];
}

function safeString(value: unknown, max = 1000): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}

function safeUrl(value: unknown): string | null {
  const raw = safeString(value, 2000);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEnvironment(raw: Record<string, unknown>): WorkspaceSandboxEnvironment | null {
  const id = safeString(raw.id, 250);
  const productKey = safeString(raw.product_key, 128);
  const provider = safeString(raw.provider, 80);
  const purpose = safeString(raw.purpose, 500);
  const url = safeUrl(raw.url);
  if (!id || !productKey || !provider || !purpose || !url) return null;

  return {
    id,
    productKey,
    provider,
    purpose,
    environmentKind: safeString(raw.environment_kind, 80) ?? "sandbox",
    url,
    providerSiteId: safeString(raw.provider_site_id, 250),
    providerVersionId: safeString(raw.provider_version_id, 250),
    sourceRepo: safeString(raw.source_repo, 250),
    sourceRef: safeString(raw.source_ref, 250),
    accessMode: safeString(raw.access_mode, 80) ?? "unknown",
    ownership: safeString(raw.ownership, 80) ?? "unknown",
    persistence: safeString(raw.persistence, 80) ?? "unknown",
    status: safeString(raw.status, 80) ?? "unknown",
    expiresAt: safeString(raw.expires_at, 100),
    lastObservedAt: safeString(raw.last_observed_at, 100),
    metadata: raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? raw.metadata as Record<string, unknown>
      : {},
  };
}

export async function getWorkspaceEnvironmentProjection(): Promise<WorkspaceEnvironmentProjection> {
  const endpoint = (process.env.ASHWOOD_WORKSPACE_ENVIRONMENTS_URL
    ?? "https://ashwood-info.vercel.app/api/workspace-sandboxes").trim();
  const token = process.env.ASHWOOD_WORKSPACE_ENVIRONMENTS_TOKEN?.trim();

  if (!token) {
    return {
      available: false,
      source: endpoint,
      observedAt: null,
      error: "workspace_environment_token_not_configured",
      environments: [],
    };
  }

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      return {
        available: false,
        source: endpoint,
        observedAt: null,
        error: `workspace_environment_source_${response.status}`,
        environments: [],
      };
    }

    const rows = Array.isArray(payload.environments) ? payload.environments : [];
    return {
      available: true,
      source: endpoint,
      observedAt: safeString(payload.observed_at, 100),
      error: null,
      environments: rows
        .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object" && !Array.isArray(row))
        .map(normalizeEnvironment)
        .filter((row): row is WorkspaceSandboxEnvironment => Boolean(row)),
    };
  } catch (error) {
    return {
      available: false,
      source: endpoint,
      observedAt: null,
      error: error instanceof Error ? error.message.slice(0, 300) : "workspace_environment_source_failed",
      environments: [],
    };
  }
}
