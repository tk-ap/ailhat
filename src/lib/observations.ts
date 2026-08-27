// Live availability observations from the owner's `live-sync` Chrome extension.
//
// This is a PURE module (no fs, no Node server APIs) so it is safe to import on
// the client for URL→workspace mapping, staleness, and merge logic. Server-only
// file persistence lives in observations.server.ts.
//
// The extension's content.js extracts {provider, cap, next, url, title,
// observedAt, method, confidence} from the VISIBLE text of an authenticated
// cto.new / ChatGPT page; popup.js augments it with {account, iface, id, use}
// and POSTs the whole body to `${dashboardUrl}/api/sync`. We accept that same
// body defensively here (all fields optional except provider/url/observedAt).
//
// Ported into ailhat's REST-router architecture (src/lib/restRoutes.ts) per
// PORTFOLIO_AND_AGENT_CONTROL.md — this is the Agent Direct capacity feed.

import type { ScanResult, Severity } from "./scanSite";

export interface AvailabilityObservation {
  provider?: string | null;
  cap?: number | null;
  next?: number | null;
  url?: string | null;
  title?: string | null;
  observedAt?: number | null;
  method?: string | null;
  confidence?: string | null;
  // Extension extras — kept for round-tripping, never required.
  account?: string | null;
  iface?: string | null;
  id?: string | null;
  use?: string | null;
}

// Scan completions are written into the SAME observation feed so they survive
// serverless cold starts with no new storage or schema. A scan row is
// identifiable by provider === SCAN_PROVIDER and is never treated as an
// availability observation (buildOverlays filters it out).
export const SCAN_PROVIDER = "site-scan";

/** Per-finding status encoded in the scan summary (fail/ok only; a "unchecked"
 * check is not positive evidence and is never counted or persisted here). */
export interface ScanFindingStatus {
  stableKey: string;
  status: "fail" | "ok";
}

/** Compact live-scan findings summary, encoded in the observation's `use` field.
 * `counts` is the CRITICAL/HIGH/MEDIUM/LOW roll-up of FAILING checks (kept for
 * backward compatibility and cheap display); `checks` carries the per-finding
 * fail/ok status so Direct can count open findings the same way Intelligence
 * does from a shared evidence source. */
export interface ScanSummary {
  ok: boolean;
  counts: Record<Severity, number>;
  checks: ScanFindingStatus[];
}

/**
 * Per-workspace live scan evidence, derived from the newest SCAN_PROVIDER
 * observation for that workspace. `findings` only counts FAILING checks — a
 * scan finding is only evidence of a problem when it actually fails.
 */
export interface ScanEvidence {
  hasScan: boolean;
  url: string | null;
  scannedAt: number;
  ok: boolean;
  findings: Record<Severity, number>;
  /** Sum of CRITICAL/HIGH/MEDIUM/LOW failing checks in the latest scan. */
  totalFailures: number;
  ageHours: number;
  tier: ConfidenceTier;
  staleness: string;
}

/** Host → workspace id for the known live portfolio. */
const HOST_TO_WORKSPACE: Record<string, string> = {
  "ailhat.vercel.app": "ailhat",
  "ledgato.vercel.app": "ledgato",
  "alviratech.vercel.app": "alvira",
  "alviratech-bridge.vercel.app": "bridge",
};

/** Pseudo-workspace id for the shared cto.new Builder bucket (Ledgato + Bridge). */
export const CTO_BUCKET_ID = "cto-bucket";

export function hostFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Map an observed URL to a workspace id.
 * - Known portfolio hosts → their workspace id.
 * - cto.new / ChatGPT pages → CTO_BUCKET_ID (the shared Builder bucket screen).
 * - Anything else → null (not-mapped; never fabricate a value for these).
 */
export function mapUrlToWorkspaceId(url?: string | null): string | null {
  const host = hostFromUrl(url);
  if (!host) return null;
  if (host === "cto.new" || host === "chatgpt.com" || host === "chat.openai.com") {
    return CTO_BUCKET_ID;
  }
  return HOST_TO_WORKSPACE[host] ?? null;
}

/**
 * True when a URL's host maps to a known, scan-ingestible product host (ailhat,
 * ledgato, alvira, alviratech-bridge). The scan endpoint only PERSISTS evidence
 * for these known hosts — an unmapped URL would be scanned but never saved, so
 * the /direct Sync scan button is only offered (functional) for these. cto.new /
 * ChatGPT pages map to the shared Builder bucket, not a product, so they are
 * never offered per-workspace either.
 */
export function isKnownScanHost(url?: string | null): boolean {
  const id = mapUrlToWorkspaceId(url);
  return id !== null && id !== CTO_BUCKET_ID;
}

/**
 * Staleness-driven confidence for an observed availability value: fresh <1h High,
 * <24h Medium, >24h Low. Never broadens an observation's credibility with age.
 */
export type ConfidenceTier = "High" | "Medium" | "Low";

export function stalenessConfidence(ageHours: number): ConfidenceTier {
  if (ageHours < 1) return "High";
  if (ageHours < 24) return "Medium";
  return "Low";
}

export function stalenessLabel(ageHours: number): string {
  if (ageHours < 1) return "fresh";
  if (ageHours < 24) return "stale";
  return "very stale";
}

export function ageLabelObs(nowMs: number, observedAt: number): string {
  const minutes = Math.max(1, Math.round((nowMs - observedAt) / 60_000));
  if (minutes < 60) return "just now";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Live observation overlay attached to a modeled workspace on the Control view.
 * Never fabricates a value: when no observation exists (or the extension saw a
 * page without a detectable %), hasLive/cap stay falsy and the UI falls back to
 * the reference baseline with a "no live observation" label.
 */
export interface LiveOverlay {
  hasLive: boolean;
  /** Observed availability % (null = page observed but no % detected). */
  cap: number | null;
  provider: string | null;
  url: string | null;
  observedAt: number;
  /** Age of the observation in hours (staleness driver). */
  ageHours: number;
  /** Staleness-driven confidence tier (fresh <1h high, <24h medium, >24h low). */
  tier: ConfidenceTier;
  staleness: string;
}

function buildOverlay(
  obs: AvailabilityObservation | null,
  nowMs: number,
): LiveOverlay | null {
  if (!obs || typeof obs.observedAt !== "number") return null;
  const ageHours = Math.max(0, (nowMs - obs.observedAt) / 3_600_000);
  return {
    hasLive: true,
    cap: typeof obs.cap === "number" ? obs.cap : null,
    provider: obs.provider ?? null,
    url: obs.url ?? null,
    observedAt: obs.observedAt,
    ageHours,
    tier: stalenessConfidence(ageHours),
    staleness: stalenessLabel(ageHours),
  };
}

export interface OverlayMap {
  /** Newest overlay per portfolio workspace id (unknown hosts are dropped). */
  byWorkspace: Map<string, LiveOverlay>;
  /** Newest overlay for the shared cto.new Builder bucket, if any. */
  bucket: LiveOverlay | null;
}

/**
 * Reduce stored observations into per-workspace overlays.
 * - Observations whose URL maps to a known workspace feed that workspace.
 * - cto.new / ChatGPT observations feed the shared Builder bucket.
 * - Unmapped hosts are ignored (never invented).
 */
export function buildOverlays(
  observations: AvailabilityObservation[],
  nowMs: number,
): OverlayMap {
  const perId = new Map<string, AvailabilityObservation>();
  const sortPick = (id: string, obs: AvailabilityObservation) => {
    const cur = perId.get(id);
    if (
      !cur ||
      (typeof obs.observedAt === "number" &&
        (typeof cur.observedAt !== "number" || obs.observedAt > cur.observedAt))
    ) {
      perId.set(id, obs);
    }
  };
  for (const obs of observations) {
    if (obs.provider === SCAN_PROVIDER) continue; // scan evidence is not availability
    const id = mapUrlToWorkspaceId(obs.url);
    if (id) sortPick(id, obs);
  }
  const byWorkspace = new Map<string, LiveOverlay>();
  for (const [id, obs] of perId) {
    if (id === CTO_BUCKET_ID) continue;
    const overlay = buildOverlay(obs, nowMs);
    if (overlay) byWorkspace.set(id, overlay);
  }
  return {
    byWorkspace,
    bucket: buildOverlay(perId.get(CTO_BUCKET_ID) ?? null, nowMs),
  };
}

// ---- Scan evidence (readiness feed) ----------------------------------------

/**
 * Convert a completed site scan into an observation row (provider = SCAN_PROVIDER)
 * so "a scan completed" survives cold starts in the same durable feed as the
 * availability rows — no new storage or schema. The findings summary is encoded
 * in the `use` field as JSON. Never fabricates: only FAILING checks are counted.
 */
export function scanEvidenceObservation(result: ScanResult): AvailabilityObservation {
  const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const checks: ScanFindingStatus[] = [];
  for (const f of result.findings) {
    if (f.status === "fail") counts[f.severity]++;
    // Store only positive fail/ok evidence — a "unchecked" check is not evidence
    // of a pass OR a fail, so it is never persisted (and never auto-closes).
    if (f.status === "fail" || f.status === "ok") {
      checks.push({ stableKey: f.stableKey, status: f.status });
    }
  }
  const summary: ScanSummary = { ok: result.ok ?? false, counts, checks };
  return {
    provider: SCAN_PROVIDER,
    url: result.url || result.requestedUrl || null,
    observedAt: result.scannedAt ?? Date.now(),
    method: "scan",
    title: result.ok ? "site scan" : "site scan (unreachable)",
    use: JSON.stringify(summary),
  };
}

/** Read back the encoded ScanSummary, or null when absent/unparseable. */
export function scanSummaryFromObservation(
  obs: AvailabilityObservation,
): ScanSummary | null {
  if (typeof obs.use !== "string") return null;
  try {
    const p = JSON.parse(obs.use) as Partial<ScanSummary>;
    const ok = typeof p.ok === "boolean" ? p.ok : true;
    const counts: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const raw = (p.counts ?? {}) as Partial<Record<Severity, number>>;
    (Object.keys(counts) as Severity[]).forEach((s) => {
      const n = Number(raw[s]);
      counts[s] = Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
    });
    const rawChecks = Array.isArray(p.checks) ? p.checks : [];
    const checks: ScanFindingStatus[] = [];
    for (const c of rawChecks) {
      if (!c || typeof c !== "object") continue;
      const rc = c as { stableKey?: unknown; status?: unknown };
      if (
        typeof rc.stableKey === "string" &&
        (rc.status === "fail" || rc.status === "ok")
      ) {
        checks.push({ stableKey: rc.stableKey, status: rc.status });
      }
    }
    return { ok, counts, checks };
  } catch {
    return null;
  }
}

/** Build ScanEvidence from the newest SCAN_PROVIDER observation for a workspace. */
export function buildScanEvidenceForObs(
  obs: AvailabilityObservation | null,
  nowMs: number,
): ScanEvidence | null {
  if (!obs || typeof obs.observedAt !== "number") return null;
  const summary = scanSummaryFromObservation(obs);
  const ageHours = Math.max(0, (nowMs - obs.observedAt) / 3_600_000);
  const findings = summary?.counts ?? { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  const zero: Record<Severity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  // Open-findings count comes from the per-finding status when available (the
  // source of truth that keeps Direct consistent with Intelligence); falls back
  // to the severity-count roll-up for observations written before the enrichment.
  const checks = summary?.checks ?? [];
  const totalFailures =
    checks.length > 0
      ? checks.filter((c) => c.status === "fail").length
      : findings.CRITICAL + findings.HIGH + findings.MEDIUM + findings.LOW;
  return {
    hasScan: true,
    url: obs.url ?? null,
    scannedAt: obs.observedAt,
    ok: summary?.ok ?? true,
    findings: { ...zero, ...findings },
    totalFailures,
    ageHours,
    tier: stalenessConfidence(ageHours),
    staleness: stalenessLabel(ageHours),
  };
}

/**
 * Reduce stored observations into per-workspace scan evidence (the newest scan
 * per workspace; unknown hosts are dropped). Returns a Map<workspaceId, ScanEvidence>.
 */
export function buildScanEvidence(
  observations: AvailabilityObservation[],
  nowMs: number,
): Map<string, ScanEvidence> {
  const perId = new Map<string, AvailabilityObservation>();
  for (const obs of observations) {
    if (obs.provider !== SCAN_PROVIDER) continue;
    if (typeof obs.observedAt !== "number") continue;
    const id = mapUrlToWorkspaceId(obs.url);
    if (!id) continue;
    const cur = perId.get(id);
    if (!cur || obs.observedAt > (cur.observedAt ?? 0)) perId.set(id, obs);
  }
  const byWorkspace = new Map<string, ScanEvidence>();
  for (const [id, obs] of perId) {
    const se = buildScanEvidenceForObs(obs, nowMs);
    if (se) byWorkspace.set(id, se);
  }
  return byWorkspace;
}

/**
 * Validate a raw POSTed observation. Returns a cleaned copy, or null (drop the
 * row) if it can't be used. Never throws — defensive by design.
 */
export function sanitizeObservation(raw: unknown): AvailabilityObservation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const provider = typeof o.provider === "string" ? o.provider : undefined;
  const url = typeof o.url === "string" ? o.url : undefined;
  const observedAt =
    typeof o.observedAt === "number" && Number.isFinite(o.observedAt)
      ? o.observedAt
      : undefined;
  // Only provider + url + observedAt are required; everything else optional.
  if (!provider || !url || !observedAt) return null;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const str = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;
  return {
    provider,
    url,
    observedAt,
    cap: num(o.cap),
    next: num(o.next),
    title: str(o.title),
    method: str(o.method),
    confidence: str(o.confidence),
    account: str(o.account),
    iface: str(o.iface),
    id: str(o.id),
    use: str(o.use),
  };
}
