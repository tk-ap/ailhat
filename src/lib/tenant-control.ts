import type { Workspace, Harness, InterfaceSlot, Severity } from "./agent-control";
import type { AppState, Item, Product } from "./store";
import {
  SCAN_PROVIDER,
  buildScanEvidenceForObs,
  hostFromUrl,
  stalenessConfidence,
  stalenessLabel,
  type AvailabilityObservation,
  type LiveOverlay,
  type ScanEvidence,
} from "./observations";

const NONE_INTERFACES: Record<Harness, InterfaceSlot> = {
  CLI: { state: "none" },
  "Web UI": { state: "none" },
  API: { state: "none" },
  Sandbox: { state: "none" },
};

function severityFor(item: Item): Severity {
  if (item.type === "bug") return "high";
  if (item.type === "issue") return "medium";
  return "low";
}

function roleFor(item: Item): "engineer" | "researcher" | "designer" | "ops" {
  if (item.type === "bug" || item.type === "feature") return "engineer";
  return "researcher";
}

function productAgeDays(product: Product, state: AppState, now: number): number {
  const activity = state.productActivity?.[product.id];
  const at = activity?.lastObservedAt ?? activity?.lastObservedSiteChangeAt ?? product.createdAt;
  return Math.max(0, Math.floor((now - at) / 86_400_000));
}

export function tenantPortfolioToWorkspaces(state: AppState, now = Date.now()): Workspace[] {
  return (state.products ?? []).map((product) => {
    const openItems = (state.items ?? []).filter((item) => item.productId === product.id && item.status !== "done");
    const history = state.scanHistory?.[product.id];
    const scanAt = history?.lastGood?.scannedAt ?? 0;
    const scanAgeHours = scanAt ? Math.max(0, (now - scanAt) / 3_600_000) : 9_999;
    const blockers = openItems.slice(0, 20).map((item) => ({ id: item.id, title: item.title, severity: severityFor(item) }));
    const actions = openItems.slice(0, 12).map((item) => ({
      id: item.id,
      title: item.title,
      role: roleFor(item),
      effort: "not estimated",
      window: "governed handoff when approved",
      launchImpact: item.type === "bug" ? "HIGH" as const : "MEDIUM" as const,
      customerImpact: item.type === "bug" ? "HIGH" as const : "MEDIUM" as const,
    }));
    const hasHigh = blockers.some((blocker) => blocker.severity === "high");
    const hasOpen = blockers.length > 0;

    return {
      id: product.id,
      name: product.name,
      tagline: "Account portfolio product",
      summary: "Modeled from this signed-in account's persisted ailhat portfolio state. No global owner seed is used.",
      url: product.url || null,
      stage: "Active portfolio product",
      readinessPct: null,
      confidence: scanAt ? "Observed" : null,
      firstPaidClient: "not assessed",
      portfolioState: hasHigh ? "BLOCKED" : hasOpen ? "NEEDS ATTENTION" : "ACTIVE",
      attention: hasHigh ? "ACT NOW" : hasOpen ? "REVIEW" : "HEALTHY",
      recommendedAgent: hasOpen ? "Agent OS / Workforce · resolve approved work" : "No action recommended",
      recommendedWindow: hasOpen ? "after explicit approval" : "not scheduled",
      estimatedEffort: hasOpen ? "not estimated" : "none",
      launchImpact: hasHigh ? "HIGH" : hasOpen ? "MEDIUM" : "LOW",
      customerImpact: hasHigh ? "HIGH" : hasOpen ? "MEDIUM" : "LOW",
      urgency: hasHigh ? "HIGH" : hasOpen ? "MEDIUM" : "LOW",
      interfaces: { ...NONE_INTERFACES },
      daysSinceAttention: productAgeDays(product, state, now),
      lastScan: scanAt ? new Date(scanAt).toISOString() : "no production scan recorded",
      scanAgeHours,
      blockers,
      actions,
    };
  });
}

function newest(rows: AvailabilityObservation[]): AvailabilityObservation | null {
  return rows.reduce<AvailabilityObservation | null>((best, row) => {
    if (typeof row.observedAt !== "number") return best;
    if (!best || typeof best.observedAt !== "number" || row.observedAt > best.observedAt) return row;
    return best;
  }, null);
}

export function buildTenantObservationEvidence(
  products: Product[],
  observations: AvailabilityObservation[],
  now = Date.now(),
): { liveByWorkspace: Map<string, LiveOverlay>; scanByWorkspace: Map<string, ScanEvidence> } {
  const liveByWorkspace = new Map<string, LiveOverlay>();
  const scanByWorkspace = new Map<string, ScanEvidence>();

  for (const product of products) {
    const productHost = hostFromUrl(product.url);
    if (!productHost) continue;
    const matching = observations.filter((row) => hostFromUrl(row.url) === productHost);
    const scan = newest(matching.filter((row) => row.provider === SCAN_PROVIDER));
    const live = newest(matching.filter((row) => row.provider !== SCAN_PROVIDER));

    const scanEvidence = buildScanEvidenceForObs(scan, now);
    if (scanEvidence) scanByWorkspace.set(product.id, scanEvidence);

    if (live && typeof live.observedAt === "number") {
      const ageHours = Math.max(0, (now - live.observedAt) / 3_600_000);
      liveByWorkspace.set(product.id, {
        hasLive: true,
        cap: typeof live.cap === "number" ? live.cap : null,
        provider: live.provider ?? null,
        url: live.url ?? null,
        observedAt: live.observedAt,
        ageHours,
        tier: stalenessConfidence(ageHours),
        staleness: stalenessLabel(ageHours),
      });
    }
  }

  return { liveByWorkspace, scanByWorkspace };
}
