import {
  EXTERNAL_OBSERVATION_SCHEMA,
  normalizeExternalObservations,
  type EvidenceSourceDeclaration,
  type ExternalObservation,
  type ProductRepositoryIdentity,
} from "./external-evidence";

const GITHUB_HOST = "github.com";
const API_ROOT = "https://api.github.com";
const DEFAULT_LIMIT = 10;

export interface GitHubRepositoryRef {
  owner: string;
  name: string;
  url: string;
}

export type GitHubEvidenceAvailability = "connected" | "unavailable";

export interface GitHubRepositoryEvidenceResult {
  productId: string;
  repository: ProductRepositoryIdentity;
  source: EvidenceSourceDeclaration;
  observations: ExternalObservation[];
  fetchedAt: number;
  availability: GitHubEvidenceAvailability;
  reason?: string;
}

interface GitHubRepoPayload {
  full_name?: string;
  html_url?: string;
  default_branch?: string;
  private?: boolean;
  archived?: boolean;
  pushed_at?: string | null;
}

interface GitHubCommitPayload {
  sha?: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { date?: string | null };
    committer?: { date?: string | null };
  };
}

interface GitHubPullPayload {
  number?: number;
  html_url?: string;
  title?: string;
  state?: string;
  merged_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  head?: { sha?: string };
  base?: { ref?: string };
}

interface GitHubIssuePayload {
  number?: number;
  html_url?: string;
  title?: string;
  state?: string;
  updated_at?: string | null;
  closed_at?: string | null;
  pull_request?: unknown;
}

export function parseGitHubRepositoryUrl(raw: string): GitHubRepositoryRef | null {
  const input = raw.trim();
  if (!input) return null;
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  if (parsed.hostname.toLowerCase() !== GITHUB_HOST) return null;
  const parts = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  if (!owner || !name) return null;
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) return null;
  return {
    owner,
    name,
    url: `https://${GITHUB_HOST}/${owner}/${name}`,
  };
}

function epoch(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstLine(value?: string): string {
  return (value ?? "").split("\n")[0].trim();
}

function safeTitle(value: string | undefined, fallback: string): string {
  const title = value?.trim();
  return title ? title.slice(0, 240) : fallback;
}

function githubHeaders(): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "ailhat-portfolio-intelligence",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function githubJson<T>(
  fetchImpl: typeof fetch,
  path: string,
): Promise<{ ok: true; value: T } | { ok: false; status: number; reason: string }> {
  let response: Response;
  try {
    response = await fetchImpl(`${API_ROOT}${path}`, {
      headers: githubHeaders(),
      cache: "no-store",
    });
  } catch {
    return { ok: false, status: 0, reason: "GitHub could not be reached." };
  }

  if (!response.ok) {
    if (response.status === 404) {
      return {
        ok: false,
        status: response.status,
        reason: "Repository not found or not publicly readable. Private repository access is not connected in this MVP.",
      };
    }
    if (response.status === 403 || response.status === 429) {
      return {
        ok: false,
        status: response.status,
        reason: "GitHub public API rate limit or access restriction prevented this observation. No repository activity should be inferred from the missing result.",
      };
    }
    return {
      ok: false,
      status: response.status,
      reason: `GitHub returned HTTP ${response.status}; repository evidence remains unavailable.`,
    };
  }

  try {
    return { ok: true, value: (await response.json()) as T };
  } catch {
    return { ok: false, status: response.status, reason: "GitHub returned an unreadable response." };
  }
}

function commitObservation(
  productId: string,
  repo: GitHubRepositoryRef,
  commit: GitHubCommitPayload,
): ExternalObservation | null {
  const sha = commit.sha?.trim();
  if (!sha) return null;
  const observedAt = epoch(commit.commit?.committer?.date) ?? epoch(commit.commit?.author?.date);
  if (!observedAt) return null;
  const shortSha = sha.slice(0, 7);
  return {
    schema: EXTERNAL_OBSERVATION_SCHEMA,
    id: `github:${repo.owner}/${repo.name}:commit:${sha}`,
    productId,
    provider: "github",
    kind: "commit",
    state: "observed",
    observedAt,
    sourceRef: sha,
    sourceUrl: commit.html_url ?? `${repo.url}/commit/${sha}`,
    summary: `Commit ${shortSha}: ${safeTitle(firstLine(commit.commit?.message), "repository change")}`,
    authoritativeFor: ["repository_activity"],
    confidence: "HIGH",
    metadata: { repository: `${repo.owner}/${repo.name}`, sha },
  };
}

function pullObservation(
  productId: string,
  repo: GitHubRepositoryRef,
  pull: GitHubPullPayload,
): ExternalObservation | null {
  if (typeof pull.number !== "number") return null;
  const mergedAt = epoch(pull.merged_at);
  const observedAt = mergedAt ?? epoch(pull.closed_at) ?? epoch(pull.updated_at);
  if (!observedAt) return null;
  const merged = mergedAt !== null;
  return {
    schema: EXTERNAL_OBSERVATION_SCHEMA,
    id: `github:${repo.owner}/${repo.name}:pull_request:${pull.number}`,
    productId,
    provider: "github",
    kind: "pull_request",
    state: merged ? "merged" : "observed",
    observedAt,
    sourceRef: `pr:${pull.number}`,
    sourceUrl: pull.html_url ?? `${repo.url}/pull/${pull.number}`,
    summary: `PR #${pull.number}${merged ? " merged" : " observed"}: ${safeTitle(pull.title, "untitled pull request")}`,
    authoritativeFor: merged ? ["repository_merge", "repository_activity"] : ["repository_activity"],
    confidence: "HIGH",
    metadata: {
      repository: `${repo.owner}/${repo.name}`,
      number: pull.number,
      ...(pull.head?.sha ? { headSha: pull.head.sha } : {}),
      ...(pull.base?.ref ? { baseBranch: pull.base.ref } : {}),
    },
  };
}

function issueObservation(
  productId: string,
  repo: GitHubRepositoryRef,
  issue: GitHubIssuePayload,
): ExternalObservation | null {
  if (issue.pull_request || typeof issue.number !== "number") return null;
  const closed = issue.state === "closed";
  const observedAt = epoch(issue.closed_at) ?? epoch(issue.updated_at);
  if (!observedAt) return null;
  return {
    schema: EXTERNAL_OBSERVATION_SCHEMA,
    id: `github:${repo.owner}/${repo.name}:issue:${issue.number}`,
    productId,
    provider: "github",
    kind: "issue",
    // Closed issue is authoritative issue-state evidence. It is not verification
    // that a product finding was resolved, so the generic external-evidence core
    // still refuses to promote this directly into verified_done.
    state: closed ? "completed" : "observed",
    observedAt,
    sourceRef: `issue:${issue.number}`,
    sourceUrl: issue.html_url ?? `${repo.url}/issues/${issue.number}`,
    summary: `Issue #${issue.number} ${closed ? "closed" : "open"}: ${safeTitle(issue.title, "untitled issue")}`,
    authoritativeFor: ["issue_state"],
    confidence: "HIGH",
    metadata: { repository: `${repo.owner}/${repo.name}`, number: issue.number },
  };
}

export async function observePublicGitHubRepository(
  productId: string,
  repositoryUrl: string,
  fetchImpl: typeof fetch = fetch,
  fetchedAt = Date.now(),
): Promise<GitHubRepositoryEvidenceResult> {
  const repo = parseGitHubRepositoryUrl(repositoryUrl);
  if (!repo) {
    return {
      productId,
      repository: {
        provider: "github",
        name: "unknown",
        url: repositoryUrl,
      },
      source: {
        provider: "github",
        availability: "unavailable",
        reason: "Use a canonical GitHub repository URL such as https://github.com/owner/repo.",
      },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason: "Invalid GitHub repository URL.",
    };
  }

  const metadata = await githubJson<GitHubRepoPayload>(
    fetchImpl,
    `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`,
  );

  const baseIdentity: ProductRepositoryIdentity = {
    provider: "github",
    owner: repo.owner,
    name: repo.name,
    url: repo.url,
  };

  if (!metadata.ok) {
    return {
      productId,
      repository: baseIdentity,
      source: { provider: "github", availability: "unavailable", reason: metadata.reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason: metadata.reason,
    };
  }

  if (metadata.value.private) {
    const reason = "This repository is private. Private GitHub repository access is not connected in the public-repo MVP.";
    return {
      productId,
      repository: baseIdentity,
      source: { provider: "github", availability: "unavailable", reason },
      observations: [],
      fetchedAt,
      availability: "unavailable",
      reason,
    };
  }

  const repository: ProductRepositoryIdentity = {
    ...baseIdentity,
    url: metadata.value.html_url ?? repo.url,
    defaultBranch: metadata.value.default_branch,
  };

  const [commits, pulls, issues] = await Promise.all([
    githubJson<GitHubCommitPayload[]>(
      fetchImpl,
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/commits?per_page=${DEFAULT_LIMIT}`,
    ),
    githubJson<GitHubPullPayload[]>(
      fetchImpl,
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/pulls?state=all&sort=updated&direction=desc&per_page=${DEFAULT_LIMIT}`,
    ),
    githubJson<GitHubIssuePayload[]>(
      fetchImpl,
      `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/issues?state=all&sort=updated&direction=desc&per_page=${DEFAULT_LIMIT}`,
    ),
  ]);

  const observations: ExternalObservation[] = [];
  if (commits.ok) {
    for (const commit of commits.value) {
      const mapped = commitObservation(productId, repo, commit);
      if (mapped) observations.push(mapped);
    }
  }
  if (pulls.ok) {
    for (const pull of pulls.value) {
      const mapped = pullObservation(productId, repo, pull);
      if (mapped) observations.push(mapped);
    }
  }
  if (issues.ok) {
    for (const issue of issues.value) {
      const mapped = issueObservation(productId, repo, issue);
      if (mapped) observations.push(mapped);
    }
  }

  const secondaryFailures = [commits, pulls, issues].filter((result) => !result.ok) as Array<{
    ok: false;
    status: number;
    reason: string;
  }>;
  const partialReason = secondaryFailures.length > 0
    ? `Repository metadata was readable, but ${secondaryFailures.length} evidence feed(s) could not be observed. Missing feed data remains unknown.`
    : undefined;

  return {
    productId,
    repository,
    source: {
      provider: "github",
      availability: "connected",
      ...(partialReason ? { reason: partialReason } : {}),
    },
    observations: normalizeExternalObservations(observations),
    fetchedAt,
    availability: "connected",
    ...(partialReason ? { reason: partialReason } : {}),
  };
}
