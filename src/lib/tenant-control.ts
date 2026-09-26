import type { Workspace, Harness, InterfaceSlot, Severity } from "./agent-control";
import type { AppState, Item, Product } from "./store";
import { applicableFindings } from "./product-profile";
import { assessLaunchReadiness } from "./launch-readiness";
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

function scanFromPortfolioHistory(state: AppState, product: Product, now: number): ScanEvidence | null {
  const result = state.scanHistory?.[product.id]?.lastGood;
  if (!result || typeof result.scannedAt !== "number") return null;
  const findings = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as ScanEvidence["findings"];
  let totalFailures = 0;
  for (const finding of applicableFindings(product, result.findings ?? [])) {
    if (finding.status !== "fail") continue;
    findings[finding.severity] += 1;
    totalFailures += 1;
  }
  const ageHours = Math.max(0, (now - result.scannedAt) / 3_600_000);
  return {
    hasScan: true,
    url: result.url || result.requestedUrl || null,
    scannedAt: result.scannedAt,
    ok: result.ok,
    findings,
    totalFailures,
    ageHours,
    tier: stalenessConfidence(ageHours),
    staleness: stalenessLabel(ageHours),
  };
}

function freshestScan(a: ScanEvidence | null, b: ScanEvidence | null): ScanEvidence | null {
  if (!a) return b;
  if (!b) return a;
  return a.scannedAt >= b.scannedAt ? a : b;
}

export function tenantPortfolioToWorkspaces(
  state: AppState,
  now = Date.now(),
  observedScans?: Map<string, ScanEvidence>,
): Workspace[] {
  return (state.products ?? []).map((product) => {
    const openItems = (state.items ?? []).filter((item) => item.productId === product.id && item.status !== "done");
    const historyScan = scanFromPortfolioHistory(state, product, now);
    const observationScan = observedScans?.get(product.id) ?? null;
    const scan = freshestScan(historyScan, observationScan);
    const scanAt = scan?.scannedAt ?? 0;
    const scanAgeHours = scan?.ageHours ?? 9_999;
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
    const highBlockerCount = blockers.filter((blocker) => blocker.severity === "high").length;
    const hasHigh = highBlockerCount > 0;
    const hasOpen = blockers.length > 0;
    const readinessAssessment = assessLaunchReadiness({
      productUrl: product.url || null,
      highBlockerCount,
      scan,
    });

    return {
      id: product.id,
      name: product.name,
      tagline: "Account portfolio product",
      summary: "Modeled from this signed-in account's persisted ailhat portfolio state. No global owner seed is used.",
      url: product.url || null,
      stage: "Active portfolio product",
      readinessPct: readinessAssessment.score,
      confidence: readinessAssessment.confidence,
      readinessAssessment,
      firstPaidClient: "not assessed",
      portfolioState: hasHigh ? "BLOCKED" : hasOpen ? "NEEDS ATTENTION" : readinessAssessment.score == null ? "NEEDS ASSESSMENT" : "ACTIVE",
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
