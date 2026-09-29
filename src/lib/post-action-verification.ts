import type { ScanFinding, ScanResult, Severity } from "./scanSite";
import type { ScanFindingStatus } from "./observations";
import { findingRelevance } from "./product-profile";
import type { Product } from "./store";

export type ProductOutcomeVerdict =
  | "IMPROVED"
  | "UNCHANGED"
  | "REGRESSED"
  | "INSUFFICIENT_EVIDENCE";

export interface ProductVerificationSnapshot {
  target: "sandbox";
  url: string;
  scannedAt: number;
  reachable: boolean;
  checks: ScanFindingStatus[];
}

export interface PostActionProductVerification {
  schema: "ailhat.post-action-product-verification/v1";
  evaluator: "ailhat.site-scan/v1";
  target: "sandbox";
  verdict: ProductOutcomeVerdict;
  reason: string;
  evaluatedAt: string;
  baseline: ProductVerificationSnapshot | null;
  observed: ProductVerificationSnapshot | null;
  resolved: string[];
  regressed: string[];
  persistent: string[];
  uncertain: string[];
  ignoredNotApplicable: string[];
}

function statusFinding(check: ScanFindingStatus): ScanFinding {
  const ruleId = check.ruleId || check.stableKey.split(":")[0] || check.stableKey;
  const severity: Severity = check.severity || "MEDIUM";
  return {
    ruleId,
    stableKey: check.stableKey,
    status: check.status,
    severity,
    confidence: "HIGH",
    title: ruleId,
    detail: "Stored scan-status evidence used for post-action comparison.",
  };
}

function relevantChecks(product: Product, snapshot: ProductVerificationSnapshot) {
  const relevant = new Map<string, ScanFindingStatus>();
  const ignored: string[] = [];
  for (const check of snapshot.checks) {
    const applicability = findingRelevance(product, statusFinding(check));
    if (applicability.status === "not_applicable") {
      ignored.push(check.stableKey);
      continue;
    }
    relevant.set(check.stableKey, check);
  }
  return { relevant, ignored };
}

export function snapshotFromScan(result: ScanResult): ProductVerificationSnapshot {
  return {
    target: "sandbox",
    url: result.url || result.requestedUrl,
    scannedAt: result.scannedAt,
    reachable: result.ok,
    checks: result.findings
      .filter((finding) => finding.status === "fail" || finding.status === "ok")
      .map((finding) => ({
        stableKey: finding.stableKey,
        status: finding.status as "fail" | "ok",
        ruleId: finding.ruleId,
        severity: finding.severity,
      })),
  };
}

export function compareProductVerification(
  product: Product,
  baseline: ProductVerificationSnapshot | null,
  observed: ProductVerificationSnapshot | null,
  now = new Date(),
): PostActionProductVerification {
  const base = baseline ? relevantChecks(product, baseline) : null;
  const current = observed ? relevantChecks(product, observed) : null;
  const ignoredNotApplicable = Array.from(new Set([
    ...(base?.ignored ?? []),
    ...(current?.ignored ?? []),
  ])).sort();

  const result: PostActionProductVerification = {
    schema: "ailhat.post-action-product-verification/v1",
    evaluator: "ailhat.site-scan/v1",
    target: "sandbox",
    verdict: "INSUFFICIENT_EVIDENCE",
    reason: "A comparable before-and-after sandbox observation is not available.",
    evaluatedAt: now.toISOString(),
    baseline,
    observed,
    resolved: [],
    regressed: [],
    persistent: [],
    uncertain: [],
    ignoredNotApplicable,
  };

  if (!baseline || !observed || !base || !current) return result;
  if (!baseline.reachable || !observed.reachable) {
    if (baseline.reachable && !observed.reachable) {
      result.verdict = "REGRESSED";
      result.reason = "The sandbox was reachable before execution but could not be reached afterward.";
    } else {
      result.reason = "The sandbox was not reachable in both comparable observations.";
    }
    return result;
  }

  const keys = new Set([...base.relevant.keys(), ...current.relevant.keys()]);
  for (const key of keys) {
    const before = base.relevant.get(key)?.status;
    const after = current.relevant.get(key)?.status;
    if (before === "fail" && after === "ok") result.resolved.push(key);
    else if (before === "ok" && after === "fail") result.regressed.push(key);
    else if (before === "fail" && after === "fail") result.persistent.push(key);
    else if (before !== after) result.uncertain.push(key);
  }

  result.resolved.sort();
  result.regressed.sort();
  result.persistent.sort();
  result.uncertain.sort();

  if (result.regressed.length > 0) {
    result.verdict = "REGRESSED";
    result.reason = `${result.regressed.length} applicable check${result.regressed.length === 1 ? "" : "s"} changed from passing to failing.`;
  } else if (result.resolved.length > 0) {
    result.verdict = "IMPROVED";
    result.reason = `${result.resolved.length} applicable check${result.resolved.length === 1 ? "" : "s"} changed from failing to passing with no observed regression.`;
  } else if (result.uncertain.length > 0) {
    result.verdict = "INSUFFICIENT_EVIDENCE";
    result.reason = "The before/after scans do not contain comparable positive evidence for every changed check.";
  } else {
    result.verdict = "UNCHANGED";
    result.reason = "No applicable scan check changed between the before and after observations.";
  }

  return result;
}
