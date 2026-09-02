// Browser-only cache boundary for account-private continuity state.
// Server persistence remains authoritative; these keys are convenience caches and
// must never survive a logout/account switch into another tenant's session.

export const TENANT_PRIVATE_STORAGE_KEYS = [
  "sortie.v1",
  "multideck.v1",
  "ailhat.solution-workflow.v1",
  "ailhat.prepared-work.v1",
  "ailhat.finding-visibility.v1",
  "ailhat.connection-intents.v1",
  "ailhat.radar-signals.v1",
] as const;

export function clearTenantPrivateStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of TENANT_PRIVATE_STORAGE_KEYS) {
    try { window.localStorage.removeItem(key); } catch { /* best effort */ }
  }
  try {
    window.dispatchEvent(new CustomEvent("ailhat:tenant-boundary-reset"));
  } catch {
    // Event dispatch is only a convenience for mounted continuity widgets.
  }
}
