// Behavior tests for the /direct "Sync scan" host gate (isKnownScanHost).
//
// Run with: bun test src/lib/observations-scan-host.test.ts
import { describe, test, expect } from "bun:test";
import { isKnownScanHost, mapUrlToWorkspaceId, CTO_BUCKET_ID } from "./observations";

describe("isKnownScanHost", () => {
  test("returns true for the four known scan-ingestible product hosts", () => {
    expect(isKnownScanHost("https://ailhat.vercel.app/")).toBe(true);
    expect(isKnownScanHost("https://ledgato.vercel.app/")).toBe(true);
    expect(isKnownScanHost("https://alviratech.vercel.app/")).toBe(true);
    expect(isKnownScanHost("https://alviratech-bridge.vercel.app/")).toBe(true);
  });

  test("returns false for unmapped / unknown hosts (scan would not be persisted)", () => {
    expect(isKnownScanHost("https://example.com/")).toBe(false);
    expect(isKnownScanHost("https://random-product.io/")).toBe(false);
  });

  test("returns false for null / undefined / empty URLs", () => {
    expect(isKnownScanHost(null)).toBe(false);
    expect(isKnownScanHost(undefined)).toBe(false);
    expect(isKnownScanHost("")).toBe(false);
  });

  test("returns false for the shared Builder bucket hosts (not a product workspace)", () => {
    expect(isKnownScanHost("https://cto.new/")).toBe(false);
    expect(isKnownScanHost("https://chat.openai.com/")).toBe(false);
  });

  test("matches mapUrlToWorkspaceId: known products map to a workspace id, bucket hosts do not", () => {
    expect(mapUrlToWorkspaceId("https://ailhat.vercel.app/")).toBe("ailhat");
    expect(mapUrlToWorkspaceId("https://ledgato.vercel.app/")).toBe("ledgato");
    expect(mapUrlToWorkspaceId("https://alviratech.vercel.app/")).toBe("alvira");
    expect(mapUrlToWorkspaceId("https://alviratech-bridge.vercel.app/")).toBe("bridge");
    expect(mapUrlToWorkspaceId("https://cto.new/")).toBe(CTO_BUCKET_ID);
    expect(mapUrlToWorkspaceId("https://example.com/")).toBeNull();
  });
});
