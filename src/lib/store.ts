// Ailhat storage + rule-based logic.
// All data lives in browser localStorage — no backend, no accounts.

// Type-only imports (no runtime side effects, SSR-safe).
import type { ScanResult, CheckStatus } from "./scanSite";
import type { ProductScanHistory } from "./observation";
import type { Opportunity } from "./opportunity";
import { mergeScan } from "./observation";

export type Platform =
  | "vercel"
  | "cto.new"
  | "madethis"
  | "netlify"
  | "cloudflare-pages"
  | "github-pages"
  | "railway"
  | "render"
  | "fly.io"
  | "replit"
  | "glitch"
  | "heroku"
  | "digitalocean"
  | "supabase"
  | "other";
export type ItemType = "bug" | "feature" | "issue";
export type ItemStatus = "open" | "in_progress" | "done";

export interface Product {
  id: string;
  name: string;
  platform: Platform;
  url: string;
  createdAt: number;
}

export interface Item {
  id: string;
  productId: string;
  type: ItemType;
  title: string;
  description?: string;
  status: ItemStatus;
  createdAt: number;
  // When set, this item was created by a "site scan" suggestion. Used to dedupe
  // scan findings so re-adding the same finding (or re-running the scan) never
  // inserts a duplicate checklist item.
  scanKey?: string;
}

// ---- Per-product decision history (owner-entered) --------------------------
// A recommendation surfaced from the Direct/seed model. The owner sets a
// disposition; the default is ALWAYS "not-decisioned" — the app never auto-claims
// deployed / paused / deferred. `reason` and `updatedAt` are the owner's honest
// entered state, timestamped on each change. Persisted via the debounced
// PUT /api/portfolio like the rest of AppState (no new tables/routes).
export type DecisionDisposition =
  | "not-decisioned"
  | "deployed"
  | "paused-for-timing"
  | "deferred";

export interface ProductDecision {
  id: string;
  title: string;
  disposition: DecisionDisposition;
  reason?: string;
  updatedAt?: number;
}

export const DECISION_DISPOSITIONS: DecisionDisposition[] = [
  "not-decisioned",
  "deployed",
  "paused-for-timing",
  "deferred",
];

/** Guard: only the enum values are allowed — never an invented disposition. */
export function isDecisionDisposition(v: unknown): v is DecisionDisposition {
  return (
    typeof v === "string" && (DECISION_DISPOSITIONS as string[]).includes(v)
  );
}

// ---- Portfolio lifecycle evidence -----------------------------------------
// Engagement is intentionally semantic instead of using one universal traffic
// threshold. A low-volume B2B product and a consumer product should not be judged
// by the same raw visit count. Analytics adapters can provide the underlying
// metrics in `summary`, but must classify against a product-appropriate baseline.
export type EngagementLevel = "healthy" | "low" | "none" | "unknown";
export type EngagementTrend = "up" | "flat" | "down" | "unknown";

export interface ProductEngagementEvidence {
  source: string;
  observedAt: number;
  windowDays: number;
  level: EngagementLevel;
  trend?: EngagementTrend;
  summary?: string;
}

// Site-change evidence is derived only from successful observations. It means
// "ailhat observed a material change in the signals it can scan", not that ailhat
// has perfect deploy history. That distinction is important for retirement prompts.
export interface ProductActivity {
  firstObservedAt?: number;
  lastObservedAt?: number;
  lastObservedSiteChangeAt?: number;
}

// A retired product leaves the active planning set, but its complete working
// context is moved into this archive so reactivation can restore it losslessly.
export interface RetiredProductArchive {
  product: Product;
  retiredAt: number;
  reason?: string;
  items: Item[];
  decisions: ProductDecision[];
  scan?: ScanResult;
  scanHistory?: ProductScanHistory;
  opportunities: Opportunity[];
  activity?: ProductActivity;
  engagement?: ProductEngagementEvidence;
}

export interface AppState {
  // Active portfolio only. Intelligence/planning engines already use this array,
  // so moving a product out of it immediately removes prime planning real estate.
  products: Product[];
  // Preserved, reversible archive. Retiring is explicitly not deletion.
  retiredProducts: RetiredProductArchive[];
  items: Item[];
  // Owner-entered decision history per product, keyed by STORE product id. Each
  // product's list is seeded from its Direct/seed model recommendations, all
  // defaulting to "not-decisioned" (never auto-claimed). Backward compatible:
  // defaults to {} on states persisted before this field existed.
  decisions: Record<string, ProductDecision[]>;
  // Latest site-scan result per product id (Step A). Persisted so the Daily
  // Brief can ground its "fresh site-scan bug" signals in objective findings.
  scans: Record<string, ScanResult>;
  // Phase 1 — automatic observation: bounded, persistent per-product scan
  // history/occurrence/differential state (drives auto-scan status + "what
  // changed" rendering). Same localStorage + server jsonb persistence as scans.
  scanHistory: Record<string, ProductScanHistory>;
  // Persistent, compact lifecycle evidence used by retirement assessment.
  productActivity: Record<string, ProductActivity>;
  engagement: Record<string, ProductEngagementEvidence>;
  // Daily Brief feedback, keyed by stable signal id. Makes attention first-class
  // and persistent even in this localStorage v1.
  feedback: Record<string, FeedbackEntry>;
  // Phase 3 — Opportunity engine. Derived from observed scan evidence and
  // persisted (localStorage + server jsonb) so Dismiss/Investigate feedback and
  // the Phase 5 attention engine can build on it. Backward compatible: defaults
  // to empty on states persisted before Phase 3.
  opportunities: Opportunity[];
  // Feedback keyed by stable opportunity id — how Ailhat personalises which
  // opportunities matter. "investigate" is non-suppressing; dismiss/acted hide.
  opportunityFeedback: Record<string, FeedbackEntry>;
}

// Feedback a builder gives to a Daily Brief signal — this is how Ailhat learns.
export type FeedbackKind =
  | "acted" // took the recommended action
  | "dismissed" // hide until the underlying signal data actually changes
  | "snoozed" // hide for a duration (SNOOZE_MS)
  | "not_important"
  | "already_handled"
  | "wrong"
  | "more"; // asked for more detail (non-suppressing)

export interface FeedbackEntry {
  kind: FeedbackKind;
  at: number;
  until?: number; // for snooze: epoch ms after which the signal may reappear
}

export const SNOOZE_MS = 24 * 60 * 60 * 1000; // 1 day

const KEY = "sortie.v1";
// Pre-rebrand storage key (from the interim "MultiDeck" name). If present on
// first load under the new key, migrate the existing data over so no demo data
// is lost. Kept for backwards-compatibility — not user-visible.
export const OLD_KEY = "multideck.v1";

export const PLATFORMS: Platform[] = [
  "vercel",
  "cto.new",
  "madethis",
  "netlify",
  "cloudflare-pages",
  "github-pages",
  "railway",
  "render",
  "fly.io",
  "replit",
  "glitch",
  "heroku",
  "digitalocean",
  "supabase",
  "other",
];
export const ITEM_TYPES: ItemType[] = ["feature", "bug", "issue"];
export const ITEM_STATUSES: ItemStatus[] = ["open", "in_progress", "done"];

const PLATFORM_LABELS: Record<Platform, string> = {
  vercel: "Vercel",
  "cto.new": "cto.new",
  madethis: "madethis",
  netlify: "Netlify",
  "cloudflare-pages": "Cloudflare Pages",
  "github-pages": "GitHub Pages",
  railway: "Railway",
  render: "Render",
  "fly.io": "Fly.io",
  replit: "Replit",
  glitch: "Glitch",
  heroku: "Heroku",
  digitalocean: "DigitalOcean",
  supabase: "Supabase",
  other: "Other",
};

// platformLabel must never crash the dashboard render, even for a legacy/unknown
// stored value (e.g. a platform added in a future version, or a stale value from
// an older save). Fall back to a safe, readable string instead of undefined.
export const platformLabel = (p: Platform): string => PLATFORM_LABELS[p] ?? "Other";

const TYPE_LABELS: Record<ItemType, string> = {
  feature: "Feature",
  bug: "Bug",
  issue: "Issue",
};
export const typeLabel = (t: ItemType) => TYPE_LABELS[t];

const TYPE_BADGE: Record<ItemType, string> = {
  feature:
    "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  bug: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  issue: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};
export const typeBadge = (t: ItemType) => TYPE_BADGE[t];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ---- Initial state (account-scoped: NO demo seed) ----
// The portfolio belongs to the authenticated owner account. Previously this
// file invented demo products (ShipFast Toolkit, CopyCraft AI, PixelDeck) and
// wrote them into localStorage on first load, so anonymous visitors saw fake
// products without logging in. That seed was removed: a fresh visitor starts
// empty, and products/items only ever come from the owner's own account
// (server-side portfolio_state once logged in) or from products they add.
function emptyState(): AppState {
  return {
    products: [],
    retiredProducts: [],
    items: [],
    decisions: {},
    scans: {},
    scanHistory: {},
    productActivity: {},
    engagement: {},
    feedback: {},
    opportunities: [],
    opportunityFeedback: {},
  };
}

export function loadState(): AppState {
  try {
    let raw = localStorage.getItem(KEY);
    // Migrate from the pre-rebrand key on first load so existing data survives.
    if (!raw) {
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        localStorage.setItem(KEY, old);
        try {
          localStorage.removeItem(OLD_KEY);
        } catch {
          /* leave old key in place */
        }
        raw = old;
      }
    }
    if (!raw) {
      const empty = emptyState();
      localStorage.setItem(KEY, JSON.stringify(empty));
      return empty;
    }
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      retiredProducts: Array.isArray(parsed.retiredProducts)
        ? (parsed.retiredProducts as RetiredProductArchive[])
        : [],
      items: Array.isArray(parsed.items) ? parsed.items : [],
      decisions:
        parsed.decisions &&
        typeof parsed.decisions === "object" &&
        !Array.isArray(parsed.decisions)
          ? (parsed.decisions as Record<string, ProductDecision[]>)
          : {},
      scans:
        parsed.scans && typeof parsed.scans === "object" && !Array.isArray(parsed.scans)
          ? (parsed.scans as Record<string, ScanResult>)
          : {},
      scanHistory:
        parsed.scanHistory &&
        typeof parsed.scanHistory === "object" &&
        !Array.isArray(parsed.scanHistory)
          ? (parsed.scanHistory as Record<string, ProductScanHistory>)
          : {},
      productActivity:
        parsed.productActivity &&
        typeof parsed.productActivity === "object" &&
        !Array.isArray(parsed.productActivity)
          ? (parsed.productActivity as Record<string, ProductActivity>)
          : {},
      engagement:
        parsed.engagement &&
        typeof parsed.engagement === "object" &&
        !Array.isArray(parsed.engagement)
          ? (parsed.engagement as Record<string, ProductEngagementEvidence>)
          : {},
      feedback:
        parsed.feedback && typeof parsed.feedback === "object" && !Array.isArray(parsed.feedback)
          ? (parsed.feedback as Record<string, FeedbackEntry>)
          : {},
      opportunities: Array.isArray(parsed.opportunities)
        ? (parsed.opportunities as Opportunity[])
        : [],
      opportunityFeedback:
        parsed.opportunityFeedback &&
        typeof parsed.opportunityFeedback === "object" &&
        !Array.isArray(parsed.opportunityFeedback)
          ? (parsed.opportunityFeedback as Record<string, FeedbackEntry>)
          : {},
    };
  } catch {
    const empty = emptyState();
    try {
      localStorage.setItem(KEY, JSON.stringify(empty));
    } catch {
      /* storage unavailable */
    }
    return empty;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — no-op */
  }
}

function omitKey<T>(record: Record<string, T> | undefined, key: string): Record<string, T> {
  const next = { ...(record ?? {}) };
  delete next[key];
  return next;
}

// ---- Actions (pure, return new state) ----
export function addProduct(state: AppState, p: Omit<Product, "id" | "createdAt">): AppState {
  const product: Product = { ...p, id: uid(), createdAt: Date.now() };
  return { ...state, products: [...state.products, product] };
}

export function updateProduct(
  state: AppState,
  id: string,
  patch: Partial<Omit<Product, "id" | "createdAt">>,
): AppState {
  return {
    ...state,
    products: state.products.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

/**
 * Permanent deletion remains available for the existing explicit delete control,
 * but unlike the old implementation it preserves the rest of AppState instead of
 * accidentally dropping scans/feedback/opportunities. Lifecycle retirement should
 * be preferred when the goal is simply to stop active planning.
 */
export function deleteProduct(state: AppState, id: string): AppState {
  return {
    ...state,
    products: state.products.filter((p) => p.id !== id),
    items: state.items.filter((i) => i.productId !== id),
    decisions: omitKey(state.decisions, id),
    scans: omitKey(state.scans, id),
    scanHistory: omitKey(state.scanHistory, id),
    productActivity: omitKey(state.productActivity, id),
    engagement: omitKey(state.engagement, id),
    opportunities: (state.opportunities ?? []).filter((o) => o.productId !== id),
    retiredProducts: (state.retiredProducts ?? []).filter((r) => r.product.id !== id),
  };
}

/**
 * Move a product out of the active portfolio while preserving every piece of
 * product-scoped context needed for future review/reactivation.
 */
export function retireProduct(
  state: AppState,
  id: string,
  reason?: string,
): AppState {
  const product = state.products.find((p) => p.id === id);
  if (!product) return state;

  const archive: RetiredProductArchive = {
    product,
    retiredAt: Date.now(),
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
    items: state.items.filter((i) => i.productId === id),
    decisions: (state.decisions ?? {})[id] ?? [],
    scan: (state.scans ?? {})[id],
    scanHistory: (state.scanHistory ?? {})[id],
    opportunities: (state.opportunities ?? []).filter((o) => o.productId === id),
    activity: (state.productActivity ?? {})[id],
    engagement: (state.engagement ?? {})[id],
  };

  return {
    ...state,
    products: state.products.filter((p) => p.id !== id),
    retiredProducts: [
      ...(state.retiredProducts ?? []).filter((r) => r.product.id !== id),
      archive,
    ],
    items: state.items.filter((i) => i.productId !== id),
    decisions: omitKey(state.decisions, id),
    scans: omitKey(state.scans, id),
    scanHistory: omitKey(state.scanHistory, id),
    productActivity: omitKey(state.productActivity, id),
    engagement: omitKey(state.engagement, id),
    opportunities: (state.opportunities ?? []).filter((o) => o.productId !== id),
  };
}

/** Restore a retired product and its archived context to active planning. */
export function reactivateProduct(state: AppState, id: string): AppState {
  if (state.products.some((p) => p.id === id)) return state;
  const archive = (state.retiredProducts ?? []).find((r) => r.product.id === id);
  if (!archive) return state;

  const itemIds = new Set(state.items.map((i) => i.id));
  const restoredItems = archive.items.filter((i) => !itemIds.has(i.id));
  const oppIds = new Set((state.opportunities ?? []).map((o) => o.id));
  const restoredOpps = archive.opportunities.filter((o) => !oppIds.has(o.id));

  return {
    ...state,
    products: [...state.products, archive.product],
    retiredProducts: (state.retiredProducts ?? []).filter((r) => r.product.id !== id),
    items: [...state.items, ...restoredItems],
    decisions: { ...(state.decisions ?? {}), [id]: archive.decisions },
    scans: archive.scan
      ? { ...(state.scans ?? {}), [id]: archive.scan }
      : state.scans,
    scanHistory: archive.scanHistory
      ? { ...(state.scanHistory ?? {}), [id]: archive.scanHistory }
      : state.scanHistory,
    productActivity: archive.activity
      ? { ...(state.productActivity ?? {}), [id]: archive.activity }
      : state.productActivity,
    engagement: archive.engagement
      ? { ...(state.engagement ?? {}), [id]: archive.engagement }
      : state.engagement,
    opportunities: [...(state.opportunities ?? []), ...restoredOpps],
  };
}

export function setEngagementEvidence(
  state: AppState,
  productId: string,
  evidence: ProductEngagementEvidence,
): AppState {
  if (!state.products.some((p) => p.id === productId)) return state;
  return {
    ...state,
    engagement: { ...(state.engagement ?? {}), [productId]: evidence },
  };
}

export function addItem(
  state: AppState,
  item: Omit<Item, "id" | "createdAt">,
): AppState {
  const full: Item = { ...item, id: uid(), createdAt: Date.now() };
  return { ...state, items: [...state.items, full] };
}

export function updateItem(
  state: AppState,
  id: string,
  patch: Partial<Omit<Item, "id" | "productId" | "createdAt">>,
): AppState {
  return {
    ...state,
    items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  };
}

export function deleteItem(state: AppState, id: string): AppState {
  return { ...state, items: state.items.filter((i) => i.id !== id) };
}

// Store the latest site-scan result for a product (used by the Daily Brief).
export function setScan(
  state: AppState,
  productId: string,
  result: ScanResult,
): AppState {
  return { ...state, scans: { ...state.scans, [productId]: result } };
}

/**
 * Pure, deterministic checklist reconciliation on a fresh scan (Part 1 of the
 * rescan loop). For each open/in_progress item of `productId` that carries a
 * `scanKey`, look the stableKey up in the new `ScanResult.findings` and auto-close
 * ONLY on positive evidence the check now passes:
 *  - finding present with status "ok"          → status "done";
 *  - otherwise the overall scan is ok AND the stableKey is absent from findings
 *    → status "done" (the check is no longer reported, mirroring mergeScan's
 *      RESOLVED logic for a previously-failing check that vanished);
 *  - otherwise unchanged.
 * Honesty discipline: never closes on "unchecked", never on a stale/absent scan
 * (result.ok === false ⇒ no signal), never fabricates a closure, never regresses
 * an already-"done" item, never touches items without a scanKey, never touches
 * other products' items. No Date.now()/nondeterminism inside.
 */
export function reconcileItemsOnScan(
  items: Item[],
  productId: string,
  result: ScanResult,
): Item[] {
  // A failed/unreachable scan carries NO signal about the findings — preserve
  // every item exactly as-is (no fabricated closures).
  if (!result.ok) return items;
  const byKey = new Map<string, CheckStatus>();
  for (const f of result.findings) byKey.set(f.stableKey, f.status);
  let changed = false;
  const next = items.map((i) => {
    // Never regress a closed item; never auto-close an item we can't tie to a
    // specific finding (no scanKey) — those need a human.
    if (i.status === "done" || !i.scanKey || i.productId !== productId) return i;
    const st = byKey.get(i.scanKey);
    if (st === "ok") {
      changed = true;
      return { ...i, status: "done" as const };
    }
    // Absent stableKey while the overall scan succeeded → the check is no longer
    // reported → treat as resolved (positive evidence only).
    if (st === undefined) {
      changed = true;
      return { ...i, status: "done" as const };
    }
    // Still failing, or "unchecked" (no positive signal) → unchanged.
    return i;
  });
  return changed ? next : items;
}

function scanFingerprint(result: ScanResult | undefined): string | null {
  if (!result?.ok) return null;
  return result.findings
    .map((f) =>
      [
        f.stableKey,
        f.status,
        f.severity,
        f.confidence,
        f.title,
        f.detail,
        f.url ?? "",
      ].join("|")
    )
    .sort()
    .join("\n");
}

// Phase 1 — record a fresh observation for a product. Updates the latest result
// (kept in sync for the brief) AND merges it into the bounded scan history
// (occurrence counts, differentials, last-known-good). Preserves last-known-good
// on a failed scan. Also reconciles the checklist so items whose checks now pass
// auto-complete (positive evidence only), keeping the open count consistent with
// a fresh scan. Successful observations additionally maintain compact lifecycle
// evidence used by retirement assessment.
export function recordScan(
  state: AppState,
  productId: string,
  result: ScanResult,
): AppState {
  const prevHistory = (state.scanHistory ?? {})[productId];
  const { history } = mergeScan(prevHistory, result);

  let productActivity = state.productActivity ?? {};
  if (result.ok) {
    const observedAt = result.scannedAt ?? Date.now();
    const prev = productActivity[productId] ?? {};
    const previousFingerprint = scanFingerprint(prevHistory?.lastGood);
    const currentFingerprint = scanFingerprint(result);
    const changed =
      previousFingerprint !== null &&
      currentFingerprint !== null &&
      previousFingerprint !== currentFingerprint;

    productActivity = {
      ...productActivity,
      [productId]: {
        firstObservedAt: prev.firstObservedAt ?? observedAt,
        lastObservedAt: observedAt,
        lastObservedSiteChangeAt: changed
          ? observedAt
          : prev.lastObservedSiteChangeAt,
      },
    };
  }

  return {
    ...state,
    items: reconcileItemsOnScan(state.items, productId, result),
    scans: { ...(state.scans ?? {}), [productId]: result },
    scanHistory: { ...(state.scanHistory ?? {}), [productId]: history },
    productActivity,
  };
}

// Record Daily Brief feedback for a stable signal id.
export function setFeedback(
  state: AppState,
  signalId: string,
  entry: Omit<FeedbackEntry, "at">,
): AppState {
  return {
    ...state,
    feedback: { ...state.feedback, [signalId]: { ...entry, at: Date.now() } },
  };
}

// Phase 3 — persist the derived opportunity list so it survives reload (the
// pure engine recomputes it from scans on every render; this keeps a copy in
// state for cross-session/Phase-5 use).
export function setOpportunities(
  state: AppState,
  opportunities: Opportunity[],
): AppState {
  return { ...state, opportunities };
}

// Record opportunity feedback (dismiss / investigate / acted / snoozed …) so
// the engine personalises which opportunities surface.
export function setOpportunityFeedback(
  state: AppState,
  oppId: string,
  entry: Omit<FeedbackEntry, "at">,
): AppState {
  return {
    ...state,
    opportunityFeedback: {
      ...state.opportunityFeedback,
      [oppId]: { ...entry, at: Date.now() },
    },
  };
}

/**
 * Wipe the portfolio back to empty. GATED: reset may only run for a clearly
 * anonymous/demo session (`allow` true). Passing `allow = false` (the
 * authenticated owner's real portfolio) is a strict no-op that returns `state`
 * unchanged — the owner's real data is NEVER silently destroyed. Pure, so it is
 * unit-testable and impossible for a caller to bypass accidentally.
 */
export function resetData(state: AppState, allow: boolean): AppState {
  if (!allow) return state;
  const empty = emptyState();
  saveState(empty);
  return empty;
}

// ---- Decision actions ----

/**
 * Replace a product's full decision list (used when seeding a product's
 * recommendations). Honesty: this only ever writes what the UI/seed provides —
 * it never invents a disposition on its own.
 */
export function setDecisions(
  state: AppState,
  productId: string,
  decisions: ProductDecision[],
): AppState {
  return {
    ...state,
    decisions: { ...(state.decisions ?? {}), [productId]: decisions },
  };
}

/**
 * Update a single decision's disposition (and optional reason), stamping the
 * change time. Pure + deterministic. The disposition must be one of the enum
 * values — anything else is ignored (never invents state).
 */
export function setDecisionDisposition(
  state: AppState,
  productId: string,
  decisionId: string,
  disposition: DecisionDisposition,
  reason?: string,
): AppState {
  if (!isDecisionDisposition(disposition)) return state;
  const list = (state.decisions ?? {})[productId] ?? [];
  const next = list.map((d) =>
    d.id === decisionId
      ? {
          ...d,
          disposition,
          ...(reason !== undefined ? { reason } : {}),
          updatedAt: Date.now(),
        }
      : d,
  );
  return { ...state, decisions: { ...(state.decisions ?? {}), [productId]: next } };
}

// ---- Derived helpers ----
export const openItems = (items: Item[]) =>
  items.filter((i) => i.status !== "done");
export const doneItems = (items: Item[]) =>
  items.filter((i) => i.status === "done");

export const itemsByProduct = (items: Item[], productId: string) =>
  items.filter((i) => i.productId === productId);

// Does this product already have a checklist item created from the given scan
// finding? Lets the scan UI dedupe so re-adding (or re-running) never inserts a
// duplicate.
export const hasScanItem = (
  items: Item[],
  productId: string,
  scanKey: string,
) =>
  items.some(
    (i) => i.productId === productId && i.scanKey === scanKey,
  );

export const productById = (products: Product[], id: string) =>
  products.find((p) => p.id === id);

// ---- Local duplicate detection (in-browser, no network) ----
export interface DuplicateFlag {
  type: "name" | "url";
  value: string;
  productName: string;
}

// Returns active OR retired portfolio entries that clash with the given name/url.
// This prevents a retired product from being accidentally recreated as a duplicate;
// the owner can reactivate it from Portfolio instead. `excludeId` lets an edit skip
// the product being edited itself.
export function detectDuplicates(
  state: AppState,
  name: string,
  url: string,
  excludeId?: string,
): DuplicateFlag[] {
  const flags: DuplicateFlag[] = [];
  const n = name.trim().toLowerCase();
  const u = url.trim().toLowerCase();
  const portfolioProducts = [
    ...state.products,
    ...(state.retiredProducts ?? []).map((r) => r.product),
  ];
  for (const p of portfolioProducts) {
    if (p.id === excludeId) continue;
    if (n && p.name.trim().toLowerCase() === n) {
      flags.push({ type: "name", value: name.trim(), productName: p.name });
    }
    if (u && p.url.trim().toLowerCase() === u) {
      flags.push({ type: "url", value: url.trim(), productName: p.name });
    }
  }
  return flags;
}

// ---- Rule-based "smart" suggestions ----
export interface Suggestion {
  id: string;
  kind: "upcoming" | "cross";
  title: string;
  detail: string;
  tone: string; // tailwind chip color classes
}

export function buildSuggestions(state: AppState): Suggestion[] {
  const out: Suggestion[] = [];
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  // --- Upcoming work: products with many open items ---
  const counts = new Map<string, number>();
  for (const i of state.items) {
    if (i.status !== "done") counts.set(i.productId, (counts.get(i.productId) ?? 0) + 1);
  }
  for (const [pid, count] of counts) {
    if (count >= 3) {
      const p = productById(state.products, pid);
      if (p) {
        out.push({
          id: `up-many-${pid}`,
          kind: "upcoming",
          title: `${count} open items on ${p.name}`,
          detail:
            "That's a lot of outstanding work. Batch a focused sprint to clear the queue.",
          tone: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
        });
      }
    }
  }

  // --- Upcoming work: open bugs with no progress (flagged as needs attention) ---
  for (const i of state.items) {
    if (i.type === "bug" && i.status === "open") {
      const p = productById(state.products, i.productId);
      out.push({
        id: `up-bug-${i.id}`,
        kind: "upcoming",
        title: `Untouched bug: “${i.title}”`,
        detail: p
          ? `${p.name} has an open bug with no progress — triage it before it compounds.`
          : "Open bug with no progress — triage it before it compounds.",
        tone: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
      });
    }
  }

  // --- Upcoming work: items older than 7 days still open ---
  for (const i of state.items) {
    if (i.status === "done") continue;
    const ageDays = (now - i.createdAt) / DAY;
    if (ageDays > 7) {
      const p = productById(state.products, i.productId);
      out.push({
        id: `up-old-${i.id}`,
        kind: "upcoming",
        title: `“${i.title}” has been open ${Math.floor(ageDays)} days`,
        detail: p
          ? `This ${i.type} on ${p.name} is aging — schedule it or descope it.`
          : `This ${i.type} is aging — schedule it or descope it.`,
        tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
      });
    }
  }

  // --- Cross-marketing: two products share a platform ---
  const byPlatform = new Map<string, Product[]>();
  for (const p of state.products) {
    const list = byPlatform.get(p.platform) ?? [];
    list.push(p);
    byPlatform.set(p.platform, list);
  }
  for (const [platform, prods] of byPlatform) {
    if (prods.length >= 2 && platform !== "other") {
      const names = prods.map((p) => p.name).join(" & ");
      out.push({
        id: `cross-same-${platform}`,
        kind: "cross",
        title: `Cross-promote ${names}`,
        detail: `Both live on ${platformLabel(platform)} — share one audience. Cross-link their landing pages and one shared announcement.`,
        tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      });
    }
  }

  // --- Cross-marketing: a product is pending a port / related feature ---
  const cross = state.items.filter(
    (i) =>
      i.type === "feature" &&
      i.status !== "done" &&
      /publish|port|cross|madethis|share/i.test(i.title),
  );
  if (cross.length > 0 && state.products.length >= 2) {
    out.push({
      id: "cross-port",
      kind: "cross",
      title: "You flagged cross-platform work",
      detail:
        "Some open features mention publishing or cross-posting. Shipping these unlocks a free cross-marketing channel — prioritize them.",
      tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    });
  }

  return out;
}
