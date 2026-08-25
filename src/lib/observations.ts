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
