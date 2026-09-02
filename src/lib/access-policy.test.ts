import { describe, expect, test } from "bun:test";
import { activeFoundingBeta, productAccessAllowed } from "./access-policy";

const NOW = Date.parse("2026-09-02T20:00:00Z");

describe("Founding Beta access policy", () => {
  test("owner access does not depend on beta entitlement", () => {
    expect(productAccessAllowed({ role: "owner", now: NOW })).toBe(true);
    expect(activeFoundingBeta({ role: "owner", now: NOW })).toBe(false);
  });

  test("active customer beta grants product access", () => {
    const input = {
      role: "customer" as const,
      betaExpiresAt: "2026-09-03T20:00:00Z",
      now: NOW,
    };
    expect(activeFoundingBeta(input)).toBe(true);
    expect(productAccessAllowed(input)).toBe(true);
  });

  test("expired beta denies product access without deleting identity", () => {
    const input = {
      role: "customer" as const,
      betaExpiresAt: "2026-09-01T20:00:00Z",
      now: NOW,
    };
    expect(activeFoundingBeta(input)).toBe(false);
    expect(productAccessAllowed(input)).toBe(false);
  });

  test("revocation immediately denies otherwise-active beta access", () => {
    const input = {
      role: "customer" as const,
      betaExpiresAt: "2026-10-01T20:00:00Z",
      betaRevokedAt: "2026-09-02T19:59:00Z",
      now: NOW,
    };
    expect(activeFoundingBeta(input)).toBe(false);
    expect(productAccessAllowed(input)).toBe(false);
  });

  test("customer with no beta grant has no private product access", () => {
    expect(productAccessAllowed({ role: "customer", now: NOW })).toBe(false);
  });
});
