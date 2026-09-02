import { describe, expect, test } from "bun:test";
import { EXTERNAL_OBSERVATION_SCHEMA, type ExternalObservation } from "./external-evidence";
import {
  buildReleaseChains,
  reconcileProductEvidence,
} from "./evidence-reconciliation";
import type { ProductScanHistory } from "./observation";

function external(
  overrides: Partial<ExternalObservation> = {},
): ExternalObservation {
  return {
    schema: EXTERNAL_OBSERVATION_SCHEMA,
    id: "gh-pr-1",
    productId: "ailhat",
    provider: "github",
    kind: "pull_request",
    state: "merged",
    observedAt: 2000,
    summary: "PR merged",
    authoritativeFor: ["repository_merge"],
    confidence: "HIGH",
    metadata: { headSha: "abcdef123456" },
    ...overrides,
  };
}

function history(scanAt: number, active = 0): ProductScanHistory {
  const issues: ProductScanHistory["issues"] = {};
  for (let i = 0; i < active; i++) {
    issues[`rule-${i}:https://ailhat.vercel.app`] = {
      stableKey: `rule-${i}:https://ailhat.vercel.app`,
      ruleId: `rule-${i}`,
      severity: "MEDIUM",
      confidence: "HIGH",
      title: `Finding ${i}`,
      detail: "still present",
      status: "fail",
      firstDetectedAt: scanAt - 100,
      lastDetectedAt: scanAt,
      occurrences: 2,
      timesResolved: 0,
      present: true,
    };
  }
  return {
    lastGood: {
      url: "https://ailhat.vercel.app",
      requestedUrl: "https://ailhat.vercel.app",
      ok: true,
      scannedAt: scanAt,
      findings: [],
    },
    lastAttempt: {
      url: "https://ailhat.vercel.app",
      requestedUrl: "https://ailhat.vercel.app",
      ok: true,
      scannedAt: scanAt,
      findings: [],
    },
    consecutiveFailures: 0,
    snapshots: [],
    issues,
  };
}

describe("cross-source evidence reconciliation", () => {
  test("missing outside evidence remains unknown", () => {
    const result = reconcileProductEvidence({
      productId: "ailhat",
      observations: [],
      sources: [
        { provider: "github", availability: "unknown" },
        { provider: "vercel", availability: "unavailable" },
      ],
      scanHistory: history(1000, 0),
    });
    expect(result.state).toBe("unknown");
    expect(result.verificationRecommended).toBe(false);
    expect(result.canClaimCurrentProductionClean).toBe(true);
  });

  test("outside work newer than production becomes verification pending", () => {
    const result = reconcileProductEvidence({
      productId: "ailhat",
      observations: [external({ observedAt: 2000 })],
      scanHistory: history(1000, 2),
    });
    expect(result.state).toBe("verification_pending");
    expect(result.verificationRecommended).toBe(true);
    expect(result.canClaimCurrentProductionClean).toBe(false);
  });

  test("matches GitHub repository evidence to a Vercel Ready deployment by commit SHA", () => {
    const observations = [
      external({ id: "pr", metadata: { headSha: "abcdef123456" }, observedAt: 2000 }),
      external({
        id: "deploy",
        provider: "vercel",
        kind: "deployment",
        state: "ready",
        observedAt: 2200,
        authoritativeFor: ["deployment_state"],
        metadata: { commitSha: "abcdef123456" },
      }),
    ];
    const chains = buildReleaseChains(observations);
    expect(chains).toHaveLength(1);
    expect(chains[0].commitSha).toBe("abcdef123456");
    expect(chains[0].repositoryObservationIds).toEqual(["pr"]);
    expect(chains[0].deploymentObservationIds).toEqual(["deploy"]);

    const result = reconcileProductEvidence({
      productId: "ailhat",
      observations,
      scanHistory: history(1000, 1),
    });
    expect(result.state).toBe("verification_pending");
    expect(result.reason).toContain("release chain");
  });

  test("fresh production verification after outside change can establish current scan cleanliness", () => {
    const result = reconcileProductEvidence({
      productId: "ailhat",
      observations: [external({ observedAt: 1500 })],
      scanHistory: history(3000, 0),
    });
    expect(result.state).toBe("verified_current");
    expect(result.canClaimCurrentProductionClean).toBe(true);
    expect(result.verificationRecommended).toBe(false);
  });

  test("fresh production scan after outside change preserves findings that still reproduce", () => {
    const result = reconcileProductEvidence({
      productId: "ailhat",
      observations: [external({ observedAt: 1500 })],
      scanHistory: history(3000, 3),
    });
    expect(result.state).toBe("persisting_after_change");
    expect(result.activeFindingCount).toBe(3);
    expect(result.canClaimCurrentProductionClean).toBe(false);
    expect(result.reason).toContain("still has 3 active findings");
  });

  test("failed deployment alone does not trigger verification", () => {
    const result = reconcileProductEvidence({
      productId: "ailhat",
      observations: [
        external({
          id: "failed",
          provider: "vercel",
          kind: "deployment",
          state: "failed",
          authoritativeFor: ["deployment_state"],
        }),
      ],
      scanHistory: history(1000, 1),
    });
    expect(result.state).toBe("observed_no_change");
    expect(result.verificationRecommended).toBe(false);
  });
});
