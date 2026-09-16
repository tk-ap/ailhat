import { describe, expect, test } from "bun:test";
import { assessLaunchReadiness, MIN_READINESS_COVERAGE } from "./launch-readiness";
import type { ScanEvidence } from "./observations";

function scan(overrides: Partial<ScanEvidence> = {}): ScanEvidence {
  return {
    hasScan: true,
    url: "https://example.com",
    scannedAt: Date.parse("2026-09-16T05:00:00Z"),
    ok: true,
    findings: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    totalFailures: 0,
    ageHours: 1,
    tier: "Medium",
    staleness: "stale",
    ...overrides,
  };
}

describe("Launch Readiness assessment", () => {
  test("does not invent a percentage before enough evidence exists", () => {
    const result = assessLaunchReadiness({
      productUrl: "https://example.com",
      highBlockerCount: 0,
      scan: null,
    });

    expect(result.coverage).toBeLessThan(MIN_READINESS_COVERAGE);
    expect(result.score).toBeNull();
    expect(result.confidence).toBeNull();
  });

  test("creates a baseline from a fresh clean production scan without treating unknowns as failures", () => {
    const result = assessLaunchReadiness({
      productUrl: "https://example.com",
      highBlockerCount: 0,
      scan: scan(),
    });

    expect(result.coverage).toBe(75);
    expect(result.score).toBe(100);
    expect(result.confidence).toBe("Medium");
    expect(result.unknownCount).toBe(5);
  });

  test("confirmed severe findings and recorded blockers reduce readiness", () => {
    const result = assessLaunchReadiness({
      productUrl: "https://example.com",
      highBlockerCount: 1,
      scan: scan({
        findings: { CRITICAL: 0, HIGH: 2, MEDIUM: 1, LOW: 0 },
        totalFailures: 3,
      }),
    });

    expect(result.score).toBe(40);
    expect(result.failingCount).toBe(3);
    expect(result.blockerCount).toBe(3);
  });

  test("stale evidence lowers confidence rather than fabricating a failure", () => {
    const result = assessLaunchReadiness({
      productUrl: "https://example.com",
      highBlockerCount: 0,
      scan: scan({ ageHours: 120, tier: "Low", staleness: "very stale" }),
    });

    expect(result.score).toBe(100);
    expect(result.confidence).toBe("Low");
  });

  test("an unreachable site fails runtime while leaving unobserved quality unknown", () => {
    const result = assessLaunchReadiness({
      productUrl: "https://example.com",
      highBlockerCount: 0,
      scan: scan({
        ok: false,
        findings: { CRITICAL: 1, HIGH: 0, MEDIUM: 0, LOW: 0 },
        totalFailures: 1,
      }),
    });

    const quality = result.dimensions.find((dimension) => dimension.id === "public-quality");
    expect(quality?.status).toBe("unknown");
    expect(result.score).toBe(38);
  });
});
