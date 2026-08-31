// Server function that surfaces each product's recommendation list for the
// per-product "Decisions" view. The recommendations are the real modeled work
// from the Direct/seed model (the same `workspace.actions` the Control surface
// ranks) — the owner's honest baseline. The Decisions view seeds each product's
// list from this, all defaulting to "not-decisioned" (the app NEVER auto-claims
// deployed / paused / deferred).
//
// ACCOUNT-SCOPED: like control-query.getAgentControl, this is gated on the owner
// session. An anonymous / invalid-session call returns an EMPTY list — the owner
// portfolio seed is never leaked to an anonymous client.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { findUserByToken, parseCookies, SESSION_COOKIE } from "./auth";
import { seedPortfolio } from "./portfolio-seed.server";
import { isOwnerEmail } from "./access";

export interface DecisionSeedRecommendation {
  id: string;
  title: string;
}

export interface DecisionSeed {
  /** Product display name — matches the workspace name and the store product name. */
  productName: string;
  recommendations: DecisionSeedRecommendation[];
}

export const getDecisionSeeds = createServerFn({ method: "GET" }).handler(
  async (): Promise<DecisionSeed[]> => {
    // Fail CLOSED on any auth error — never serve the owner's seed anonymously.
    let user = null;
    try {
      const token =
        parseCookies(getRequest().headers.get("cookie"))[SESSION_COOKIE] ?? "";
      user = token ? await findUserByToken(token) : null;
    } catch {
      user = null;
    }
    if (!user || !isOwnerEmail(user.email)) return [];

    return seedPortfolio.map((ws) => ({
      productName: ws.name,
      recommendations: ws.actions.map((a) => ({
        id: a.id,
        title: a.title,
      })),
    }));
  },
);
