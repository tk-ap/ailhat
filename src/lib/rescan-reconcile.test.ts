// Behavior tests for the rescan-reconcile loop (Part 1 + Part 2):
//   (a)-(g) checklist auto-complete reconciliation on a fresh scan (store.ts)
//   (h)     Intelligence and Direct report the same open-findings count for the
//           same product+scan after the evidence-feed enrichment (observations.ts)
//
// Run with: bun test src/lib/rescan-reconcile.test.ts
import { describe, test, expect } from "bun:test";
import type { ScanResult, ScanFinding, Severity, CheckStatus } from "./scanSite";
import {
  recordScan,
  reconcileItemsOnScan,
  type Item,
  type ItemStatus,
  type AppState,
} from "./store";
import {
  scanEvidenceObservation,
  buildScanEvidenceForObs,
  buildScanEvidence,
  type AvailabilityObservation,
} from "./observations";

const URL = "https://ailhat.vercel.app";

function finding(
  ruleId: string,
  status: CheckStatus,
  severity: Severity = "HIGH",
): ScanFinding {
  return {
    ruleId,
    severity,
    confidence: "HIGH",
    title: `${ruleId} check`,
    detail: `${ruleId} detail`,
    status,
    stableKey: `${ruleId}:${URL}`,
    url: URL,
  };
}

function scan(findings: ScanFinding[], ok = true): ScanResult {
  return {
    url: URL,
    requestedUrl: URL,
    ok,
    scannedAt: 1000,
    findings,
  };
}

interface ItemOpts {
  status?: ItemStatus;
  scanKey?: string;
  productId?: string;
}
function item(id: string, opts: ItemOpts = {}): Item {
  return {
    id,
    productId: opts.productId ?? "p1",
    type: "issue",
    title: `item ${id}`,
    status: opts.status ?? "open",
    createdAt: 1,
    scanKey: opts.scanKey,
  };
}

describe("reconcileItemsOnScan — rescan auto-complete (Part 1)", () => {
  test("(a) fail -> ok auto-closes the item", () => {
    const items = [item("i1", { scanKey: `meta:${URL}` })];
    const next = reconcileItemsOnScan(items, "p1", scan([finding("meta", "ok")]));
    expect(next[0].status).toBe("done");
  });

  test("(b) still-failing finding does NOT close the item", () => {
    const items = [item("i1", { scanKey: `meta:${URL}` })];
    const next = reconcileItemsOnScan(items, "p1", scan([finding("meta", "fail")]));
    expect(next[0].status).toBe("open");
  });

  test("(c) unchecked (no ok evidence) does NOT close", () => {
    const items = [item("i1", { scanKey: `meta:${URL}` })];
    const next = reconcileItemsOnScan(items, "p1", scan([finding("meta", "unchecked")]));
    expect(next[0].status).toBe("open");
  });

  test("(d) absent stableKey + overall-ok scan closes", () => {
    // The item's check is no longer reported at all and the scan succeeded.
    const items = [item("i1", { scanKey: `meta:${URL}` })];
    const next = reconcileItemsOnScan(items, "p1", scan([finding("other", "ok")]));
    expect(next[0].status).toBe("done");
  });

  test("(d2) absent stableKey does NOT close on a failed/unreachable scan", () => {
    const items = [item("i1", { scanKey: `meta:${URL}` })];
    const next = reconcileItemsOnScan(items, "p1", scan([], false));
    expect(next[0].status).toBe("open");
  });

  test("(e) items without a scanKey are never touched", () => {
    const items = [item("i1", { status: "open" })]; // no scanKey
    const next = reconcileItemsOnScan(items, "p1", scan([finding("meta", "ok")]));
    expect(next[0].status).toBe("open");
  });

  test("(f) already-done items are never regressed", () => {
    const items = [item("i1", { scanKey: `meta:${URL}`, status: "done" })];
    const next = reconcileItemsOnScan(items, "p1", scan([finding("meta", "fail")]));
    expect(next[0].status).toBe("done");
  });

  test("(g) reconciliation is idempotent", () => {
    const items = [item("i1", { scanKey: `meta:${URL}` })];
    const res = scan([finding("meta", "ok")]);
    const once = reconcileItemsOnScan(items, "p1", res);
    const twice = reconcileItemsOnScan(once, "p1", res);
    expect(once[0].status).toBe("done");
    expect(twice[0].status).toBe("done");
    expect(twice).toEqual(once); // no further mutation on re-apply
  });

  test("items for OTHER products are never touched", () => {
    const items = [item("i1", { scanKey: `meta:${URL}`, productId: "p2" })];
    const next = reconcileItemsOnScan(items, "p1", scan([finding("meta", "ok")]));
    expect(next[0].status).toBe("open");
  });

  test("recordScan wires reconciliation and persists via state", () => {
    const items = [
      item("a", { scanKey: `meta:${URL}` }), // becomes ok -> done
      item("b", { scanKey: `robots:${URL}` }), // still failing -> open
    ];
    const state: AppState = {
      products: [],
      items,
      scans: {},
      scanHistory: {},
      feedback: {},
      opportunities: [],
      opportunityFeedback: {},
    };
    const res = scan([finding("meta", "ok"), finding("robots", "fail")]);
    const next = recordScan(state, "p1", res);
    expect(next.items.find((i) => i.id === "a")?.status).toBe("done");
    expect(next.items.find((i) => i.id === "b")?.status).toBe("open");
    expect(next.scans.p1).toBe(res);
  });
});

describe("evidence-feed enrichment + consistency (Part 2)", () => {
  test("h: Intelligence and Direct return the same open-findings count", () => {
    // One scan: A and B failing, C ok. All three become checklist items.
    const res = scan([
      finding("a", "fail"),
      finding("b", "fail"),
      finding("c", "ok", "LOW"),
    ]);
    const items = [
      item("A", { scanKey: "a:" + URL }),
      item("B", { scanKey: "b:" + URL }),
      item("C", { scanKey: "c:" + URL }),
    ];
    const state: AppState = {
      products: [],
      items,
      scans: {},
      scanHistory: {},
      feedback: {},
      opportunities: [],
      opportunityFeedback: {},
    };
    const next = recordScan(state, "p1", res);

    // Intelligence open-findings count = still-open checklist items for p1.
    const intelligence = next.items.filter(
      (i) => i.productId === "p1" && i.status !== "done",
    ).length;
    expect(intelligence).toBe(2); // A, B still failing; C auto-closed

    // Direct open-findings count from the enriched evidence feed.
    const obs = scanEvidenceObservation(res);
    const directSingle = buildScanEvidenceForObs(obs, 2000);
    expect(directSingle?.totalFailures).toBe(2);

    // And via the full per-workspace reduce on a known host.
    const byWorkspace = buildScanEvidence([obs as AvailabilityObservation], 2000);
    expect(byWorkspace.get("ailhat")?.totalFailures).toBe(2);

    expect(directSingle?.totalFailures).toBe(intelligence);
    expect(byWorkspace.get("ailhat")?.totalFailures).toBe(intelligence);
    // Provenance framing preserved (computed-live path drives the same number).
    expect(directSingle?.ok).toBe(true);
    expect(directSingle?.hasScan).toBe(true);
  });

  test("enrichment carries per-finding fail/ok (round-trips through use)", () => {
    const res = scan([finding("a", "fail"), finding("b", "ok", "LOW")]);
    const obs = scanEvidenceObservation(res);
    const parsed = JSON.parse(obs.use as string);
    expect(parsed.checks).toEqual([
      { stableKey: "a:" + URL, status: "fail" },
      { stableKey: "b:" + URL, status: "ok" },
    ]);
    expect(parsed.counts.HIGH).toBe(1); // only failing checks counted
  });

  test("legacy observation without checks falls back to severity counts", () => {
    const legacy: AvailabilityObservation = {
      provider: "site-scan",
      url: URL,
      observedAt: 1000,
      method: "scan",
      use: JSON.stringify({ ok: true, counts: { CRITICAL: 1, HIGH: 1, MEDIUM: 0, LOW: 0 } }),
    };
    const se = buildScanEvidenceForObs(legacy, 2000);
    expect(se?.totalFailures).toBe(2);
  });
});
