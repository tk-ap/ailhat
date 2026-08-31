// Presentation-only visibility for persisted scan findings.
//
// Important: this module never mutates ProductScanHistory. Hiding/condensing a
// resolved finding is a view preference, not deletion. If a finding regresses,
// the active evidence always wins and the finding must surface again.

import type { ObservedIssue } from "./observation";

export type FindingDisplayPreference = "expanded" | "condensed" | "hidden";

const KEY = "ailhat.finding-visibility.v1";

export type FindingVisibilityState = Record<string, FindingDisplayPreference>;

export function findingVisibilityKey(productId: string, stableKey: string): string {
  return `${productId}::${stableKey}`;
}

export function loadFindingVisibility(): FindingVisibilityState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as FindingVisibilityState;
  } catch {
    return {};
  }
}

export function saveFindingVisibility(state: FindingVisibilityState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Presentation preference only; storage failure must never affect evidence.
  }
}

export function setFindingDisplayPreference(
  state: FindingVisibilityState,
  productId: string,
  stableKey: string,
  preference: FindingDisplayPreference,
): FindingVisibilityState {
  return {
    ...state,
    [findingVisibilityKey(productId, stableKey)]: preference,
  };
}

export function effectiveFindingDisplay(
  state: FindingVisibilityState,
  productId: string,
  issue: ObservedIssue,
): FindingDisplayPreference {
  // Current failures are operational evidence. A previously-resolved issue that
  // returns (timesResolved > 0 + present) is a regression and must re-surface,
  // regardless of an older hide/condense preference.
  if (issue.present) return "expanded";

  // Resolved findings default to condensed history, preserving evidence while
  // keeping active surfaces quiet. The user may explicitly hide them.
  return state[findingVisibilityKey(productId, issue.stableKey)] ?? "condensed";
}

export function findingLifecycleLabel(issue: ObservedIssue): "regressed" | "active" | "resolved" {
  if (issue.present && issue.timesResolved > 0) return "regressed";
  if (issue.present) return "active";
  return "resolved";
}
