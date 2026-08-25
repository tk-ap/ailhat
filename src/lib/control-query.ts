// Server function the Agent Control route uses to load the ranked portfolio
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
import { buildOverlays } from "./observations";
import type { AvailabilityObservation, LiveOverlay } from "./observations";
import { seedPortfolio } from "./portfolio-seed.server";
import { modelWorkspaces, modelWorkspace } from "./control-scoring";
import type { ModeledWorkspace } from "./control-scoring";
import { findUserByToken, parseCookies, SESSION_COOKIE } from "./auth";

export interface ControlPayload {
  /** False when the request did not carry a valid owner session. */
  authenticated: boolean;
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
      return {
        authenticated: false,
        observations: [],
        bucket: null,
        portfolio: [],
        modeledAt: now,
      };
    }

    const observations = await readObservations();
    const { byWorkspace, bucket } = buildOverlays(observations, now);
    const portfolio = modelWorkspaces(seedPortfolio, now).map((m) => {
      // Keep the model's "rescan now" behaviour simple: model the current
      // evidence age, only merging the live observation overlay on top.
      return {
        ...modelWorkspace(
          seedPortfolio.find((w) => w.id === m.ws.id) ?? m.ws,
          now,
        ),
        live: byWorkspace.get(m.ws.id) ?? null,
      } as ModeledWorkspace;
    });
    return { authenticated: true, observations, bucket, portfolio, modeledAt: now };
  },
);