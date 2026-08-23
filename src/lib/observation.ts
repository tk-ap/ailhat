// Phase 1 — Automatic Observation: persistent, bounded scan history + idempotent
// occurrence tracking + scan differentials (NEW / RESOLVED / PERSISTING /
// REGRESSED / IMPROVED). Pure, SSR-safe, no dependencies, grounded ONLY in real
// scan data (never fabricates findings). Every status/differential maps back to an
// actual ScanResult.
//
// State lives alongside the existing AppState shape (localStorage + server-side
// portfolio_state jsonb) under `state.scanHistory`. `state.scans` (the latest
// result per product, used by the brief) stays in sync.

import type {
  ScanResult,
  ScanFinding,
  Severity,
  Confidence,
  CheckStatus,
} from "./scanSite";

export type DiffKind =
  | "NEW"
  | "RESOLVED"
  | "PERSISTING"
  | "REGRESSED"
  | "IMPROVED";

/** One persistent finding, deduped by stableKey across many refreshes. */
export interface ObservedIssue {
  stableKey: string;
  ruleId: string;
  severity: Severity;
  confidence: Confidence;
  title: string;
  detail: string;
  url?: string;
  status: CheckStatus;
  firstDetectedAt: number;
  lastDetectedAt: number;
  /** Number of distinct successful scans the issue appeared as a failing check. */
  occurrences: number;
  /** Number of times the issue went away (enables REGRESSED detection). */
  timesResolved: number;
  /** True if the issue is currently a failing check in the latest scan. */
  present: boolean;
}

/** Compact per-scan capture of every finding (any status) — memory-light. */
export interface CompactCheck {
  stableKey: string;
  title: string;
  detail: string;
  severity: Severity;
  confidence: Confidence;
  status: CheckStatus;
  url?: string;
}

export interface ScanSnapshot {
  at: number;
  ok: boolean;
  url: string;
  checks: CompactCheck[];
}

/** Bounded, persistent per-product observation record. */
export interface ProductScanHistory {
  /** Most recent successful scan — drives "Live / Updated Xs ago" + the brief. */
  lastGood?: ScanResult;
  /** Most recent scan attempt (success or failure) — drives unavailable/Retry. */
  lastAttempt?: ScanResult;
  /** Consecutive failed scan attempts since the last success. */
  consecutiveFailures: number;
  /** Bounded timeline of recent successful scans (cap MAX_SNAPSHOTS). */
  snapshots: ScanSnapshot[];
  /** stableKey → persisted issue (occurrence + dedup bookkeeping). */
  issues: Record<string, ObservedIssue>;
}

export interface ScanDiff {
  stableKey: string;
  kind: DiffKind;
  title: string;
  detail: string;
  severity: Severity;
  url?: string;
}

/** Cap on snapshots kept per product (oldest pruned). Bounded memory. */
export const MAX_SNAPSHOTS = 6;
/** Cap on tracked issues per product (least-recently-seen pruned). */
export const MAX_ISSUES = 120;

export function emptyProductScanHistory(): ProductScanHistory {
  return { consecutiveFailures: 0, snapshots: [], issues: {} };
}

export function compactOf(f: ScanFinding): CompactCheck {
  return {
    stableKey: f.stableKey,
    title: f.title,
    detail: f.detail,
    severity: f.severity,
    confidence: f.confidence,
    status: f.status,
    url: f.url,
  };
}

export function snapshotOf(result: ScanResult): ScanSnapshot {
  return {
    at: result.scannedAt ?? Date.now(),
    ok: result.ok,
    url: result.url,
    checks: result.findings.map(compactOf),
  };
}

/**
 * Compute the transition between two snapshots. `prev` undefined → every
 * currently-failing check is NEW. REGRESSED is upgraded from NEW by the caller
 * using persisted resolution history (computeDiffs has no memory of it).
 */
export function computeDiffs(
  prev: ScanSnapshot | undefined,
  cur: ScanSnapshot,
): ScanDiff[] {
  const diffs: ScanDiff[] = [];
  if (!prev) {
    for (const c of cur.checks) {
      if (c.status === "fail") {
        diffs.push({
          stableKey: c.stableKey,
          kind: "NEW",
          title: c.title,
          detail: c.detail,
          severity: c.severity,
          url: c.url,
        });
      }
    }
    return diffs;
  }

  const prevStatus = new Map<string, CompactCheck>();
  for (const c of prev.checks) prevStatus.set(c.stableKey, c);
  const curStatus = new Map<string, CompactCheck>();
  for (const c of cur.checks) curStatus.set(c.stableKey, c);

  for (const c of cur.checks) {
    const p = prevStatus.get(c.stableKey);
    if (c.status === "fail") {
      if (!p || p.status !== "fail") {
        diffs.push({
          stableKey: c.stableKey,
          kind: "NEW",
          title: c.title,
          detail: c.detail,
          severity: c.severity,
          url: c.url,
        });
      } else {
        diffs.push({
          stableKey: c.stableKey,
          kind: "PERSISTING",
          title: c.title,
          detail: c.detail,
          severity: c.severity,
          url: c.url,
        });
      }
    } else if (c.status === "ok" && p && p.status !== "ok") {
      // A measurable quality signal improved (was failing/unchecked, now ok).
      diffs.push({
        stableKey: c.stableKey,
        kind: "IMPROVED",
        title: c.title,
        detail: c.detail,
        severity: c.severity,
        url: c.url,
      });
    }
  }

  // RESOLVED: previously-failing checks now absent or no longer failing.
  for (const [key, p] of prevStatus) {
    if (p.status !== "fail") continue;
    const c = curStatus.get(key);
    if (!c || c.status !== "fail") {
      diffs.push({
        stableKey: key,
        kind: "RESOLVED",
        title: p.title,
        detail: p.detail,
        severity: p.severity,
        url: p.url,
      });
    }
  }

  return diffs;
}

/**
 * Merge a fresh successful scan result into the per-product history: updates
 * occurrence counts (idempotent dedup), tracks resolution history, keeps a
 * bounded snapshot timeline, and returns the NEW/RESOLVED/PERSISTING/REGRESSED/
 * IMPROVED transition for this scan. A failed observation never destroys
 * last-known-good data and never fabricates differentials.
 */
export function mergeScan(
  history: ProductScanHistory | undefined,
  result: ScanResult,
): { history: ProductScanHistory; diffs: ScanDiff[] } {
  const base = history ?? emptyProductScanHistory();

  if (!result.ok) {
    // Unreachable / failed observation: we have NO signal about the findings, so
    // we preserve last-known-good and record only the failed attempt (coefficient
    // to drive the "Scan unavailable / Retry" state). No fabricated diffs, and
    // previously-open issues are NOT marked resolved.
    return {
      history: {
        ...base,
        lastAttempt: result,
        consecutiveFailures: base.consecutiveFailures + 1,
        lastGood: base.lastGood,
      },
      diffs: [],
    };
  }

  const cur = snapshotOf(result);
  const prev = base.snapshots[base.snapshots.length - 1] as ScanSnapshot | undefined;
  const curFails = new Map<string, CompactCheck>();
  for (const c of cur.checks) if (c.status === "fail") curFails.set(c.stableKey, c);

  // Idempotent occurrence bookkeeping.
  const issues = { ...base.issues };
  for (const [key, c] of curFails) {
    const ex = issues[key];
    if (ex) {
      issues[key] = {
        ...ex,
        title: c.title,
        detail: c.detail,
        severity: c.severity,
        confidence: c.confidence,
        url: c.url ?? ex.url,
        status: "fail",
        lastDetectedAt: cur.at,
        occurrences: ex.occurrences + 1,
        present: true,
      };
    } else {
      issues[key] = {
        stableKey: key,
        ruleId: key.split(":")[0],
        severity: c.severity,
        confidence: c.confidence,
        title: c.title,
        detail: c.detail,
        url: c.url,
        status: "fail",
        firstDetectedAt: cur.at,
        lastDetectedAt: cur.at,
        occurrences: 1,
        timesResolved: 0,
        present: true,
      };
    }
  }

  // Previously-present issues that vanished → resolved.
  for (const [key, ex] of Object.entries(issues)) {
    if (ex.present && !curFails.has(key)) {
      issues[key] = { ...ex, present: false, timesResolved: ex.timesResolved + 1 };
    }
  }

  // Bound the issues map (drop oldest by lastDetectedAt).
  const issueKeys = Object.keys(issues);
  if (issueKeys.length > MAX_ISSUES) {
    const sorted = issueKeys
      .map((k) => issues[k])
      .sort((a, b) => a.lastDetectedAt - b.lastDetectedAt);
    for (let i = 0; i < sorted.length - MAX_ISSUES; i++) {
      delete issues[sorted[i].stableKey];
    }
  }

  // Bound the snapshot timeline (oldest pruned).
  const snapshots = [...base.snapshots, cur];
  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.splice(0, snapshots.length - MAX_SNAPSHOTS);
  }

  let diffs = computeDiffs(prev, cur);
  // Upgrade NEW → REGRESSED when this issue was previously fixed and returned.
  diffs = diffs.map((d) => {
    if (d.kind === "NEW") {
      const issue = issues[d.stableKey];
      if (issue && issue.timesResolved > 0) {
        return { ...d, kind: "REGRESSED" };
      }
    }
    return d;
  });

  return {
    history: {
      lastGood: result,
      lastAttempt: result,
      consecutiveFailures: 0,
      snapshots,
      issues,
    },
    diffs,
  };
}

/**
 * Recompute the most recent transition (second-to-last vs last snapshots) for
 * display, upgrading NEW → REGRESSED from persisted resolution history.
 */
export function lastDiffs(
  history: ProductScanHistory | undefined,
): ScanDiff[] {
  if (!history || history.snapshots.length < 2) return [];
  const prev = history.snapshots[history.snapshots.length - 2];
  const cur = history.snapshots[history.snapshots.length - 1];
  if (!cur.ok) return [];
  return computeDiffs(prev, cur).map((d) => {
    if (d.kind !== "NEW") return d;
    const issue = history.issues?.[d.stableKey];
    return issue && issue.timesResolved > 0 ? { ...d, kind: "REGRESSED" } : d;
  });
}

/** Human "Updated Xs ago" from an epoch ms timestamp. */
export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Aggregate a diff list into {NEW, RESOLVED, PERSISTING, REGRESSED, IMPROVED}. */
export function diffCounts(diffs: ScanDiff[]): Record<DiffKind, number> {
  const c: Record<DiffKind, number> = {
    NEW: 0,
    RESOLVED: 0,
    PERSISTING: 0,
    REGRESSED: 0,
    IMPROVED: 0,
  };
  for (const d of diffs) c[d.kind]++;
  return c;
}
