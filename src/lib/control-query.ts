// Server function for Agent Direct. Authenticated portfolio/evidence is returned
// only when the current account has active product access.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { readObservations } from "./observations.server";
import type { AvailabilityObservation, LiveOverlay } from "./observations";
import { modelWorkspaces } from "./control-scoring";
import type { ModeledWorkspace } from "./control-scoring";
import { modelDemoPortfolio } from "./demo-portfolio";
import { findUserByToken, parseCookies, SESSION_COOKIE } from "./auth";
import { getAccountAccess } from "./access.server";
import { getPortfolioState } from "./db-portfolio";
import type { AppState } from "./store";
import { buildTenantObservationEvidence, tenantPortfolioToWorkspaces } from "./tenant-control";

export interface ControlPayload {
  authenticated: boolean;
  demo?: boolean;
  accessBlocked?: boolean;
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

export const getAgentControl = createServerFn({ method: "GET" }).handler(async (): Promise<ControlPayload> => {
  const now = Date.now();
  let user = null;
  try {
    const token = parseCookies(getRequest().headers.get("cookie"))[SESSION_COOKIE] ?? "";
    user = token ? await findUserByToken(token) : null;
  } catch { user = null; }

  if (!user) {
    return { authenticated: false, demo: true, observations: [], bucket: null, portfolio: modelDemoPortfolio(now), modeledAt: now };
  }

  const access = await getAccountAccess(user);
  if (!access.productAccess) {
    return { authenticated: true, accessBlocked: true, observations: [], bucket: null, portfolio: [], modeledAt: now };
  }

  const [rawState, observations] = await Promise.all([getPortfolioState(user.id), readObservations(user.id)]);
  const state = normalizeTenantState(rawState);
  const workspaces = tenantPortfolioToWorkspaces(state, now);
  const evidence = buildTenantObservationEvidence(state.products, observations, now);
  return {
    authenticated: true,
    observations,
    bucket: null,
    portfolio: modelWorkspaces(workspaces, now, evidence),
    modeledAt: now,
  };
});
