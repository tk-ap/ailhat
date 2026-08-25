// Ailhat storage + rule-based logic.
// All data lives in browser localStorage — no backend, no accounts.

// Type-only imports (no runtime side effects, SSR-safe).
import type { ScanResult } from "./scanSite";
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

export interface AppState {
  products: Product[];
  items: Item[];
  // Latest site-scan result per product id (Step A). Persisted so the Daily
  // Brief can ground its "fresh site-scan bug" signals in objective findings.
  scans: Record<string, ScanResult>;
  // Phase 1 — automatic observation: bounded, persistent per-product scan
  // history/occurrence/differential state (drives auto-scan status + "what
  // changed" rendering). Same localStorage + server jsonb persistence as scans.
  scanHistory: Record<string, ProductScanHistory>;
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
    items: [],
    scans: {},
    scanHistory: {},
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
      items: Array.isArray(parsed.items) ? parsed.items : [],
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

export function deleteProduct(state: AppState, id: string): AppState {
  return {
    products: state.products.filter((p) => p.id !== id),
    items: state.items.filter((i) => i.productId !== id),
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

// Phase 1 — record a fresh observation for a product. Updates the latest result
// (kept in sync for the brief) AND merges it into the bounded scan history
// (occurrence counts, differentials, last-known-good). Preserves last-known-good
// on a failed scan.
export function recordScan(
  state: AppState,
  productId: string,
  result: ScanResult,
): AppState {
  const prevHistory = (state.scanHistory ?? {})[productId];
  const { history } = mergeScan(prevHistory, result);
  return {
    ...state,
    scans: { ...(state.scans ?? {}), [productId]: result },
    scanHistory: { ...(state.scanHistory ?? {}), [productId]: history },
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

export function resetData(): AppState {
  const empty = emptyState();
  saveState(empty);
  return empty;
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

// Returns the existing portfolio entries that clash with the given name/url.
// `excludeId` lets an edit skip the product being edited itself.
export function detectDuplicates(
  state: AppState,
  name: string,
  url: string,
  excludeId?: string,
): DuplicateFlag[] {
  const flags: DuplicateFlag[] = [];
  const n = name.trim().toLowerCase();
  const u = url.trim().toLowerCase();
  for (const p of state.products) {
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
