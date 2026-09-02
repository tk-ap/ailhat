// Server function for the Agent Direct surface.
// Authenticated Direct is modeled exclusively from the signed-in user's persisted
// portfolio + tenant-scoped observations. The historical owner seed is never read
// on an authenticated path. Anonymous users receive only the synthetic demo model.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readObservations } from "./observations.server";
import type { AvailabilityObservation, LiveOverlay } from "./observations";
import { modelWorkspaces } from "./control-scoring";
import type { ModeledWorkspace } from "./control-scoring";
import { modelDemoPortfolio } from "./demo-portfolio";
import { findUserByToken, parseCookies, SESSION_COOKIE } from "./auth";
import { getPortfolioState } from "./db-portfolio";
import type { AppState } from "./store";
import { buildTenantObservationEvidence, tenantPortfolioToWorkspaces } from "./tenant-control";

export interface ControlPayload {
  authenticated: boolean;
  demo?: boolean;
  observations: AvailabilityObservation[];
  bucket: LiveOverlay | null;
  portfolio: ModeledWorkspace[];
  modeledAt: number;
}

function normalizeTenantState(raw: unknown): AppState {
  const value = raw && typeof raw === "object" ? raw as Partial<AppState> : {};
  return {
    products: Array.isArray(value.products) ? value.products : [],
    retiredProducts: Array.isArray(value.retiredProducts) ? value.retiredProducts : [],
    items: Array.isArray(value.items) ? value.items : [],
    decisions: value.decisions && typeof value.decisions === "object" ? value.decisions : {},
    scans: value.scans && typeof value.scans === "object" ? value.scans : {},
    scanHistory: value.scanHistory && typeof value.scanHistory === "object" ? value.scanHistory : {},
    productActivity: value.productActivity && typeof value.productActivity === "object" ? value.productActivity : {},
    engagement: value.engagement && typeof value.engagement === "object" ? value.engagement : {},
    feedback: value.feedback && typeof value.feedback === "object" ? value.feedback : {},
    opportunities: Array.isArray(value.opportunities) ? value.opportunities : [],
    opportunityFeedback: value.opportunityFeedback && typeof value.opportunityFeedback === "object" ? value.opportunityFeedback : {},
  } as AppState;
}

export const getAgentControl = createServerFn({ method: "GET" }).handler(
  async (): Promise<ControlPayload> => {
    const now = Date.now();
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
        demo: true,
        observations: [],
        bucket: null,
        portfolio: modelDemoPortfolio(now),
        modeledAt: now,
      };
    }

    const [rawState, observations] = await Promise.all([
      getPortfolioState(user.id),
      readObservations(user.id),
    ]);
    const state = normalizeTenantState(rawState);
    const workspaces = tenantPortfolioToWorkspaces(state, now);
    const evidence = buildTenantObservationEvidence(state.products, observations, now);
    const portfolio = modelWorkspaces(workspaces, now, evidence);

    return {
      authenticated: true,
      observations,
      bucket: null,
      portfolio,
      modeledAt: now,
    };
  },
);
