import { describe, expect, test } from "bun:test";
import {
  EXTERNAL_OBSERVATION_SCHEMA,
  assessExternalEvidence,
  buildEvidenceSourceStates,
  createProductEvidenceIdentity,
  normalizeExternalObservations,
  sanitizeExternalObservation,
  type ExternalObservation,
} from "./external-evidence";

function observation(
  overrides: Partial<ExternalObservation> = {},
): ExternalObservation {
  return {
    schema: EXTERNAL_OBSERVATION_SCHEMA,
    id: "obs-1",
    productId: "ailhat",
    provider: "github",
    kind: "pull_request",
    state: "merged",
    observedAt: 2000,
    sourceRef: "pr:40",
    sourceUrl: "https://github.com/tk-ap/ailhat/pull/40",
    summary: "PR #40 merged",
    authoritativeFor: ["repository_merge"],
    confidence: "HIGH",
    ...overrides,
  };
}

describe("external evidence core", () => {
  test("a product can exist with only a public URL", () => {
    expect(createProductEvidenceIdentity("ailhat", ["https://ailhat.vercel.app/"])).toEqual({
      productId: "ailhat",
      publicUrls: ["https://ailhat.vercel.app/"],
      repositories: [],
      deployments: [],
      workspaces: [],
    });
  });

  test("missing external sources remain unknown, not zero activity", () => {
    const result = assessExternalEvidence({
      productId: "ailhat",
      observations: [],
      sources: [
        { provider: "github", availability: "unknown", reason: "not connected" },
        { provider: "vercel", availability: "unknown", reason: "not connected" },
      ],
    });

    expect(result.state).toBe("unknown");
    expect(result.canClaimResolved).toBe(false);
    expect(result.reason).toContain("unknown");
    expect(result.sourceStates.map((source) => source.observationCount)).toEqual([0, 0]);
  });

  test("a merged PR newer than a finding becomes verification pending", () => {
    const result = assessExternalEvidence({
      productId: "ailhat",
      observations: [observation({ observedAt: 3000 })],
      conditionObservedAt: 2500,
    });

    expect(result.state).toBe("verification_pending");
    expect(result.verificationPending).toBe(true);
    expect(result.canClaimResolved).toBe(false);
    expect(result.changeObservationIds).toEqual(["obs-1"]);
  });

  test("a successful deployment acknowledges release but does not verify resolution", () => {
    const result = assessExternalEvidence({
      productId: "ailhat",
      observations: [
        observation({
          id: "deploy-1",
          provider: "vercel",
          kind: "deployment",
          state: "ready",
          authoritativeFor: ["deployment_state"],
          summary: "Production deployment is Ready",
        }),
      ],
    });

    expect(result.state).toBe("external_change_observed");
    expect(result.canClaimResolved).toBe(false);
    expect(result.reason).toContain("cannot claim resolution");
  });

  test("a failed deployment is observed evidence but not successful change evidence", () => {
    const result = assessExternalEvidence({
      productId: "ailhat",
      observations: [
        observation({
          id: "deploy-failed",
          provider: "vercel",
          kind: "deployment",
          state: "failed",
          authoritativeFor: ["deployment_state"],
          summary: "Production deployment failed",
        }),
      ],
    });

    expect(result.state).toBe("observed_no_change");
    expect(result.changeObservationIds).toEqual([]);
  });

  test("stable observation ids dedupe to the newest evidence", () => {
    const rows = normalizeExternalObservations([
      observation({ id: "same", observedAt: 1000, state: "observed" }),
      observation({ id: "same", observedAt: 2000, state: "merged" }),
      observation({ id: "other", observedAt: 1500 }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("same");
    expect(rows[0].state).toBe("merged");
  });

  test("an actual observation makes that provider connected for the snapshot", () => {
    const states = buildEvidenceSourceStates(
      [observation()],
      [
        { provider: "github", availability: "unknown" },
        { provider: "vercel", availability: "unknown" },
      ],
    );

    expect(states.find((source) => source.provider === "github")?.availability).toBe("connected");
    expect(states.find((source) => source.provider === "vercel")?.availability).toBe("unknown");
  });

  test("raw provider data is rejected when authority scope is missing", () => {
    expect(
      sanitizeExternalObservation({
        id: "bad",
        productId: "ailhat",
        provider: "github",
        kind: "pull_request",
        state: "merged",
        observedAt: 1000,
        summary: "Merged",
        confidence: "HIGH",
        authoritativeFor: [],
      }),
    ).toBeNull();
  });

  test("sanitization preserves only supported authority and metadata fields", () => {
    const result = sanitizeExternalObservation({
      id: "gh-1",
      productId: "ailhat",
      provider: "github",
      kind: "commit",
      state: "observed",
      observedAt: 1000,
      summary: "Commit observed",
      confidence: "HIGH",
      authoritativeFor: ["repository_activity", "not-real"],
      metadata: { sha: "abc", additions: 4, nested: { no: true } },
    });

    expect(result?.authoritativeFor).toEqual(["repository_activity"]);
    expect(result?.metadata).toEqual({ sha: "abc", additions: 4 });
  });
});
