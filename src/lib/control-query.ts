// Server function the Agent Direct route uses to load the ranked portfolio
// merged with live availability observations. Runs server-side under
// `bun run publish` (SSR) — fetch/storage only happens server-side.
//
// ACCOUNT-SCOPED: the portfolio is the owner's private data. The handler
// resolves the session cookie the same way /api/portfolio does (findUserByToken)
// and only serves the modeled portfolio to an authenticated user. An anonymous
// (or invalid-session) call returns `authenticated: false` with an EMPTY
// portfolio — never the global seed.
//
// Returns plain serializable data: the modeled+ranked portfolio (with live
// overlay + provenance attached per product) and the shared cto.new Builder
// bucket observation, plus the raw observation list for provenance display.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readObservations } from "./observations.server";
import { buildOverlays, buildScanEvidence } from "./observations";
import type { AvailabilityObservation, LiveOverlay } from "./observations";
import { seedPortfolio } from "./portfolio-seed.server";
import { modelWorkspaces } from "./control-scoring";
import type { ModeledWorkspace } from "./control-scoring";
import { modelDemoPortfolio } from "./demo-portfolio";
import { findUserByToken, parseCookies, SESSION_COOKIE } from "./auth";

export interface ControlPayload {
  /** False when the request did not carry a valid owner session. */
  authenticated: boolean;
  /**
   * True when `portfolio` holds the clearly-labeled SAMPLE (demo) portfolio for
   * an anonymous visitor — NEVER the owner's real projects.
   */
  demo?: boolean;
  observations: AvailabilityObservation[];
  bucket: LiveOverlay | null;
  portfolio: ModeledWorkspace[];
  modeledAt: number;
}

export const getAgentControl = createServerFn({ method: "GET" }).handler(
  async (): Promise<ControlPayload> => {
    const now = Date.now();

    // Resolve the calling user from the session cookie. Fail CLOSED: any error
    // (or missing/invalid session) yields an empty payload, never the seed.
    let user = null;
    try {
      const token = parseCookies(getRequest().headers.get("cookie"))[SESSION_COOKIE] ?? "";
      user = token ? await findUserByToken(token) : null;
    } catch {
      user = null;
    }
    if (!user) {
      // Anonymous visitor: return the CLEARLY-LABELED sample (demo) portfolio so
      // the product's value is graspable before signup. This is invented data —
      // the owner's real portfolio is never served here.
      return {
        authenticated: false,
        demo: true,
        observations: [],
        bucket: null,
        portfolio: modelDemoPortfolio(now),
        modeledAt: now,
      };
    }

    const observations = await readObservations();
    const { byWorkspace, bucket } = buildOverlays(observations, now);
    const scanByWorkspace = buildScanEvidence(observations, now);
    // Note: evidence is attached inside modelWorkspaces, so the readiness /
    // confidence recomputation (computed-live vs anchored-seed vs unassessed)
    // happens in one deterministic pass.
    const portfolio = modelWorkspaces(seedPortfolio, now, {
      scanByWorkspace,
      liveByWorkspace: byWorkspace,
    });
    return { authenticated: true, observations, bucket, portfolio, modeledAt: now };
  },
);