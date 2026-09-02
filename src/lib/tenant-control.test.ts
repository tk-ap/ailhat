import { describe, expect, test } from "bun:test";
import { buildTenantObservationEvidence, tenantPortfolioToWorkspaces } from "./tenant-control";
import type { AppState } from "./store";
import type { AvailabilityObservation } from "./observations";

function state(): AppState {
  return {
    products: [
      { id: "p-a", name: "Alpha", platform: "vercel", url: "https://alpha-example.vercel.app", createdAt: 100 },
      { id: "p-b", name: "Beta", platform: "other", url: "https://beta.example.com", createdAt: 100 },
    ],
    retiredProducts: [],
    items: [
      { id: "i-a", productId: "p-a", type: "bug", title: "Fix activation", status: "open", createdAt: 200 },
    ],
    decisions: {}, scans: {}, scanHistory: {}, productActivity: {}, engagement: {}, feedback: {}, opportunities: [], opportunityFeedback: {},
  };
}

describe("tenant Agent Direct", () => {
  test("models only products supplied by the tenant state", () => {
    const workspaces = tenantPortfolioToWorkspaces(state(), 1_000);
    expect(workspaces.map((row) => row.id)).toEqual(["p-a", "p-b"]);
    expect(workspaces.some((row) => row.id === "ailhat")).toBe(false);
    expect(workspaces[0].blockers.map((row) => row.id)).toEqual(["i-a"]);
  });

  test("does not fabricate capacity when the tenant has no availability evidence", () => {
    const evidence = buildTenantObservationEvidence(state().products, [], 10_000);
    expect(evidence.liveByWorkspace.size).toBe(0);
    expect(evidence.scanByWorkspace.size).toBe(0);
  });

  test("maps arbitrary hosts through tenant product identity instead of a global host allowlist", () => {
    const observations: AvailabilityObservation[] = [
      { provider: "custom-harness", url: "https://beta.example.com/status", observedAt: 9_000, cap: 42 },
    ];
    const evidence = buildTenantObservationEvidence(state().products, observations, 10_000);
    expect(evidence.liveByWorkspace.get("p-b")?.cap).toBe(42);
    expect(evidence.liveByWorkspace.has("p-a")).toBe(false);
  });

  test("does not attach another hostname's observation to a tenant product", () => {
    const observations: AvailabilityObservation[] = [
      { provider: "custom-harness", url: "https://someone-else.example.com", observedAt: 9_000, cap: 99 },
    ];
    const evidence = buildTenantObservationEvidence(state().products, observations, 10_000);
    expect(evidence.liveByWorkspace.size).toBe(0);
  });
});
