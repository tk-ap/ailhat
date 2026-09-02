// Ailhat Daily Brief / Attention Engine — pure logic over AppState.
//
// Observe → Understand → Detect signals → Prioritize → Recommend. Every signal
// is grounded in observable data that already exists in the store (products,
// checklist items, persisted site-scans). No browser globals, SSR-safe, no deps.
//
// The unit is ATTENTION, not tasks: ACT NOW / REVIEW / OPPORTUNITY / HEALTHY,
// each with evidence, reasoning, recommendation, and a concrete action.

import type { AppState, Item, ItemStatus, ItemType } from "./store";
import type { ScanFinding } from "./scanSite";
import { severityToItemType } from "./scanSite";
import { assessQueueStall } from "./work-lifecycle";

export type AttentionLevel = "ACT_NOW" | "REVIEW" | "OPPORTUNITY" | "HEALTHY";

export const LEVEL_ORDER: Record<AttentionLevel, number> = {
  ACT_NOW: 0,
  REVIEW: 1,
  OPPORTUNITY: 2,
  HEALTHY: 3,
};

export interface SignalInference {
  kind: "observation" | "inference";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  basis: string[];
  missingEvidence?: string[];
}

// Concrete checklist item that can be added to a product (deduped on add).
export interface RecItem {
  productId: string;
  productName: string;
  type: ItemType;
  title: string;
  description?: string;
  scanKey?: string;
}

export interface Signal {
  id: string; // stable across recompute → feedback can target it
  level: AttentionLevel;
  title: string;
  productId?: string;
  productName?: string;
  summary: string;
  evidence: string[]; // the concrete data + why it's a signal
  reasoning: string;
  recommendation: string;
  action: string; // concrete suggested action (sentence)
  priority: number; // higher = more important within a level
  recItems: RecItem[]; // recommended checklist item(s) to add
  actOnItem?: { id: string; label: string; toStatus: ItemStatus };
  inference?: SignalInference;
}

const DAY = 24 * 60 * 60 * 1000;

// ---- thresholds (tunable, exported for tests) ----
export const OLD_BUG_DAYS = 7; // open bug older than this → ACT NOW
export const STALLED_OPEN = 3; // unresolved-item count that triggers a queue review
export const STALLED_DONE_DAYS = 7; // absence of done work is evidence, not proof of a stall
export const SCAN_FRESH_DAYS = 3; // scan younger than this counts as "fresh"
export const CROSS_TITLE_RE =
  /publish|port|cross|madethis|vercel|share/i; // signals cross-platform intent

const isOpen = (i: Item) => i.status !== "done";
const ageDays = (at: number, now: number) => (now - at) / DAY;

/** Ignore trivial words when sniffing shared audience from product names. */
const STOP = new Set([
  "ai", "app", "the", "toolkit", "kit", "deck", "craft", "studio", "hub",
]);

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !STOP.has(t));
}

function productName(products: AppState["products"], id?: string): string {
  const p = products.find((x) => x.id === id);
  return p ? p.name : "your product";
}

// ---- signal builders ----

function oldBugSignal(
  p: AppState["products"][number],
  overdue: Item[],
  now: number,
): Signal {
  const oldest = overdue.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
  const days = Math.max(...overdue.map((i) => Math.round(ageDays(i.createdAt, now))));
  return {
    id: `old-bug-${p.id}`,
    level: "ACT_NOW",
    productId: p.id,
    productName: p.name,
    title: `${days} days since “${oldest.title}” was filed`,
    summary: `An open bug on ${p.name} has gone stale — users are hitting it and nobody has touched it.`,
    evidence: overdue.map(
      (i) =>
        `“${i.title}” has been open ${Math.round(ageDays(i.createdAt, now))} days (>${OLD_BUG_DAYS} day threshold) on ${p.name}`,
    ),
    reasoning:
      "Open bugs that sit untouched compound — frustrated users, and the fix gets progressively harder to scope. This is the oldest unresolved bug on the product.",
    recommendation: "Resolve the stale bug on " + p.name + " now.",
    action: "Triage “" + oldest.title + "” — fix it, mark it in progress, or descope it.",
    priority: 1000 + Math.round(days),
    recItems: [],
    actOnItem: {
      id: oldest.id,
      label: `Move “${oldest.title}” to in progress`,
      toStatus: "in_progress",
    },
  };
}

function scanBugSignal(
  p: AppState["products"][number],
  fails: ScanFinding[],
): Signal {
  return {
    id: `scan-bug-${p.id}`,
    level: "ACT_NOW",
    productId: p.id,
    productName: p.name,
    title: `${fails.length} objective bug${fails.length > 1 ? "s" : ""} on ${p.name} (site scan)`,
    summary:
      "A fresh site scan found objective failures — broken assets or insecure links that visitors will actually hit.",
    evidence: fails.map((f) => `${f.title} — ${f.detail}`),
    reasoning:
      "The site scan objectively confirmed these failures (broken links, missing resources, insecure http:// references). They damage trust and are cheap to fix while the page is in front of users.",
    recommendation: "Fix the scan-confirmed bugs on " + p.name + ".",
    action: "Turn each failed check into a checklist item, then fix them this week.",
    priority: 900 + fails.length,
    recItems: fails.map((f) => ({
      productId: p.id,
      productName: p.name,
      type: "bug" as ItemType,
      title: f.title,
      description: `From site scan — ${f.detail}`,
      scanKey: f.stableKey,
    })),
  };
}

function polishScanSignal(
  p: AppState["products"][number],
  fails: ScanFinding[],
): Signal {
  return {
    id: `review-polish-${p.id}`,
    level: "REVIEW",
    productId: p.id,
    productName: p.name,
    title: `${p.name} is missing polish (${fails.length} scan issue${fails.length > 1 ? "s" : ""})`,
    summary:
      "The site scan found only cosmetic/polish issues — nothing that breaks the experience, but worth a pass before you push awareness.",
    evidence: fails.map((f) => `${f.title} — ${f.detail}`),
    reasoning:
      "These failures (missing meta/OG tags, favicon, robots.txt, sitemap) don't block users, but they cap SEO, sharing, and indexing — a low-effort polish pass before marketing.",
    recommendation: "Clean up the scan polish items on " + p.name + ".",
    action: "Turn each polish check into a checklist item and knock them out in one sitting.",
    priority: 300 + fails.length,
    recItems: fails.map((f) => ({
      productId: p.id,
      productName: p.name,
      type: severityToItemType(f.severity),
      title: f.title,
      description: `From site scan — ${f.detail}`,
      scanKey: f.stableKey,
    })),
  };
}

function queueReviewSignal(
  p: AppState["products"][number],
  open: Item[],
): Signal {
  const assessment = assessQueueStall({
    openCount: open.length,
    recentCompletionObserved: false,
    activeExecutionObserved: false,
    // Item lifecycle history does not currently prove that the whole queue was
    // unchanged across repeated observations, so ailhat must not call it stalled.
    repeatedUnchangedObservationObserved: false,
    dispositionEvidenceObserved: false,
  }, STALLED_OPEN);

  const missingEvidence =
    assessment.state === "suspected"
      ? assessment.missingEvidence
      : [
          "Whether this same queue remained unchanged across repeated observations.",
          "Whether work completed outside ailhat's observed surfaces.",
          "Whether items were deliberately deferred, descoped, or superseded.",
        ];

  return {
    id: `queue-review-${p.id}`,
    level: "REVIEW",
    productId: p.id,
    productName: p.name,
    title: `${open.length} unresolved items on ${p.name} need a queue decision`,
    summary:
      `ailhat observes ${open.length} unresolved items and no recorded completion in the last ${STALLED_DONE_DAYS} days. That is a queue-state observation, not proof that shipping has stalled.`,
    evidence: [
      `${open.length} unresolved items (>=${STALLED_OPEN}) are recorded on ${p.name}: ` +
        open.map((i) => `“${i.title}”`).join(", "),
      `No done item created in the last ${STALLED_DONE_DAYS} days is recorded for ${p.name}.`,
      "No unresolved item is currently marked in progress.",
    ],
    reasoning:
      `${assessment.reason} ailhat does not yet have enough item-transition evidence to establish an unchanged queue, deliberate disposition, or external completion as fact.`,
    recommendation: "Review the unresolved queue on " + p.name + " and record the decision state.",
    action:
      "Mark active work in progress, or disposition each item as Act, Defer, Descope, Supersede, or Already fixed; verify the original condition before retiring work as done.",
    priority: 450 + open.length,
    recItems: [],
    inference: {
      kind: "inference",
      confidence: "MEDIUM",
      basis: [
        `${open.length} unresolved items are recorded.`,
        `No recent completion is recorded within ${STALLED_DONE_DAYS} days.`,
        "No item is marked in progress.",
      ],
      missingEvidence,
    },
  };
}

function reviewOpenSignal(p: AppState["products"][number], open: Item[]): Signal {
  return {
    id: `review-open-${p.id}`,
    level: "REVIEW",
    productId: p.id,
    productName: p.name,
    title: `${open.length} open item${open.length > 1 ? "s" : ""} on ${p.name}`,
    summary:
      p.name + " has open work that isn't an emergency but needs a decision on next step.",
    evidence: open.map(
      (i) =>
        `“${i.title}” (${i.type}, ${i.status.replace("_", " ")}) — open ${Math.round(ageDays(i.createdAt, Date.now()))} days`,
    ),
    reasoning:
      "These items are open but none is a stale bug, so nothing is urgent. Still, left without a plan they'll quietly age into problems.",
    recommendation: "Decide the next step for each open item on " + p.name + ".",
    action: "Sort these into in-progress / scheduled / descoped so the queue actually moves.",
    priority: 400 + open.length,
    recItems: [],
  };
}

function healthySignal(products: AppState["products"], p: AppState["products"][number]): Signal {
  return {
    id: `healthy-${p.id}`,
    level: "HEALTHY",
    productId: p.id,
    productName: p.name,
    title: `${p.name} is clear`,
    summary: p.name + " has no open items and no site-scan failures. Nothing needs your attention here.",
    evidence: [`No open items and no failing site-scan checks on ${p.name}.`],
    reasoning:
      "With a clean checklist and no objective scan failures, there's no actionable signal — this is healthy.",
    recommendation: "Keep it this way; check back when you next ship.",
    action: "Nothing required right now.",
    priority: 0,
    recItems: [],
  };
}

function crossPlatformSignal(
  platform: string,
  prods: AppState["products"][number][],
): Signal {
  const a = prods[0];
  const b = prods[1];
  const names = prods.map((p) => p.name);
  return {
    id: `opp-same-platform-${platform}`,
    level: "OPPORTUNITY",
    title: `Cross-promote ${names.join(" & ")}`,
    summary:
      names.join(" + ") + " both live on " + platform + " — they share one audience and can market each other for free.",
    evidence: prods.map((p) => `${p.name} is on ${platform} (${p.url || "no URL"})`),
    reasoning:
      "Products on the same platform naturally reach a shared audience. Cross-linking and a joint announcement double each product's exposure at zero cost.",
    recommendation: "Cross-promote " + a.name + " and " + b.name + ".",
    action:
      "Cross-link their landing pages and post one joint announcement to the shared " +
      platform + " audience.",
    priority: 200,
    recItems: [
      {
        productId: a.id,
        productName: a.name,
        type: "feature",
        title: `Cross-promote with ${b.name}`,
        description: `Both ship on ${platform} — add a cross-link to ${b.name} and coordinate a shared announcement.`,
      },
    ],
  };
}

function crossPortSignal(
  products: AppState["products"],
  item: Item,
  source: AppState["products"][number],
): Signal {
  // Find a target platform the user already ships on, if one is mentioned.
  const hit = item.title.toLowerCase();
  const target = products.find(
    (p) => p.id !== source.id && hit.includes(p.platform.toLowerCase()),
  );
  const targetLabel = target ? ` on ${target.name || target.platform}` : "";
  const names = products.map((p) => p.name);
  return {
    id: `opp-cross-port-${item.id}`,
    level: "OPPORTUNITY",
    productId: source.id,
    productName: source.name,
    title: `“${item.title}” unlocks cross-platform reach`,
    summary:
      source.name +
      " already has a queued feature to reach another platform — shipping it opens a free distribution channel.",
    evidence: [
      `Open feature on ${source.name}: “${item.title}”${item.description ? " — " + item.description : ""}`,
    ],
    reasoning:
      "You've flagged cross-platform intent yourself. With " +
      names.length +
      " products in the portfolio, one shared announcement reaches them all — a leverage play, not busywork.",
    recommendation: "Ship the cross-platform work on " + source.name + ".",
    action:
      "Finish “" + item.title + "”" + targetLabel +
      ", then announce once and point every product at it.",
    priority: 200,
    recItems: [
      {
        productId: source.id,
        productName: source.name,
        type: "feature",
        title: `Announce ${source.name}${target ? " to " + target.name + "" : " across your channels"}`,
        description: `Pair the release of “${item.title}” with one shared announcement across your whole portfolio.`,
      },
    ],
  };
}

function nameAffinitySignal(
  products: AppState["products"],
  a: AppState["products"][number],
  b: AppState["products"][number],
  token: string,
): Signal {
  const names = [a.name, b.name].sort();
  return {
    id: `opp-name-affinity-${[a.id, b.id].sort().join("-")}`,
    level: "OPPORTUNITY",
    title: `${names.join(" & ")} sound like one audience (share “${token}”)`,
    summary:
      names.join(" and ") +
      " share a naming theme — likely one audience that would love both products cross-linked.",
    evidence: [
      `${a.name} and ${b.name} both use “${token}” in their names`,
    ],
    reasoning:
      "A shared name token is a weak but real audience-overlap signal. Cross-linking two themed products costs minutes and can move users between them.",
    recommendation: "Cross-link " + names.join(" and ") + ".",
    action:
      "Add a " + names.join(" ↔ ") + " cross-link on both landing pages and test whether audiences transfer.",
    priority: 100,
    recItems: [
      {
        productId: a.id,
        productName: a.name,
        type: "feature",
        title: `Cross-link with ${b.name}`,
        description: `Both products share the “${token}” theme — add a cross-link so users discover the other.`,
      },
    ],
  };
}

/** Generate every signal from the raw store state (no feedback filtering). */
export function computeBrief(state: AppState): Signal[] {
  const now = Date.now();
  const signals: Signal[] = [];
  // Default to [] / {} so the engine tolerates a partial state (e.g. the empty
  // store used during SSR, before localStorage hydrates).
  const products = state?.products ?? [];
  const items = state?.items ?? [];
  const scans = state?.scans ?? {};

  // ---- per-product signals ----
  for (const p of products) {
    const pItems = items.filter((i) => i.productId === p.id);
    const open = pItems.filter(isOpen);
    const openBugs = open.filter((i) => i.type === "bug");
    const overdueBugs = openBugs.filter(
      (i) => ageDays(i.createdAt, now) > OLD_BUG_DAYS,
    );

    const scan = scans[p.id];
    const scanFresh = scan && now - scan.scannedAt < SCAN_FRESH_DAYS * DAY;
    // Phase 2 severity model: CRITICAL/HIGH are objective, experience-breaking
    // bugs (broken links/resources, whole-site failure) → "scan bug" attention.
    // MEDIUM/LOW are polish/quality gaps → "review" attention.
    const bugs = scan?.findings.filter(
      (f) =>
        f.status === "fail" &&
        (f.severity === "CRITICAL" || f.severity === "HIGH"),
    ) ?? [];
    const polish = scan?.findings.filter(
      (f) =>
        f.status === "fail" &&
        f.severity !== "CRITICAL" &&
        f.severity !== "HIGH",
    ) ?? [];

    const done = pItems.filter((i) => i.status === "done");
    const recentDone = done.some((i) => now - i.createdAt < STALLED_DONE_DAYS * DAY);
    const activeExecutionObserved = open.some((i) => i.status === "in_progress");
    const queueNeedsDecision =
      open.length >= STALLED_OPEN &&
      !recentDone &&
      !activeExecutionObserved;

    let urgent = false;

    if (overdueBugs.length > 0) {
      signals.push(oldBugSignal(p, overdueBugs, now));
      urgent = true;
    }
    if (scanFresh && bugs.length > 0) {
      signals.push(scanBugSignal(p, bugs));
      urgent = true;
    }

    if (!urgent) {
      if (queueNeedsDecision) {
        // Current AppState does not retain enough item-transition evidence to
        // prove repeated unchanged observations, so this is deliberately a
        // REVIEW signal rather than a definitive ACT_NOW "stalled" diagnosis.
        signals.push(queueReviewSignal(p, open));
      } else if (scanFresh && bugs.length === 0 && polish.length > 0) {
        signals.push(polishScanSignal(p, polish));
      } else if (open.length > 0) {
        signals.push(reviewOpenSignal(p, open));
      } else {
        // no open items and no actionable scan failure → healthy
        signals.push(healthySignal(products, p));
      }
    }
  }

  // ---- cross-product (portfolio) signals ----
  // Same-platform audience.
  const byPlatform = new Map<string, AppState["products"][number][]>();
  for (const p of products) {
    if (p.platform === "other") continue;
    const list = byPlatform.get(p.platform) ?? [];
    list.push(p);
    byPlatform.set(p.platform, list);
  }
  for (const [platform, prods] of byPlatform) {
    if (prods.length >= 2) signals.push(crossPlatformSignal(platform, prods.slice(0, 2)));
  }

  // Queued cross-platform feature → opportunity.
  if (products.length >= 2) {
    for (const item of items) {
      if (item.type === "feature" && item.status !== "done" && CROSS_TITLE_RE.test(item.title)) {
        const src = products.find((p) => p.id === item.productId);
        if (src) signals.push(crossPortSignal(products, item, src));
      }
    }
  }

  // Name-affinity → potential shared audience.
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const a = products[i];
      const b = products[j];
      const ta = nameTokens(a.name);
      const tb = nameTokens(b.name);
      const shared = ta.find((t) => tb.includes(t));
      if (shared) signals.push(nameAffinitySignal(products, a, b, shared));
    }
  }

  return signals;
}

// ---- feedback-aware filtering + ranking ----

/** Hides signals the builder has already acted on / dismissed / snoozed. */
export function applyFeedback(
  signals: Signal[],
  feedback: AppState["feedback"],
  now = Date.now(),
): Signal[] {
  const hidden = new Set<string>();
  for (const [id, fb] of Object.entries(feedback ?? {})) {
    if (fb.kind === "snoozed") {
      if (fb.until !== undefined && now < fb.until) hidden.add(id);
      // expired snooze → signal reappears
    } else if (
      fb.kind === "dismissed" ||
      fb.kind === "not_important" ||
      fb.kind === "already_handled" ||
      fb.kind === "wrong" ||
      fb.kind === "acted"
    ) {
      hidden.add(id);
    }
  }
  return signals.filter((s) => !hidden.has(s.id));
}

/**
 * Deterministic ranking: level order, then priority desc within a level, then
 * title for stable tie-breaking.
 */
export function rankSignals(signals: Signal[]): Signal[] {
  return [...signals].sort((a, b) => {
    const la = LEVEL_ORDER[a.level];
    const lb = LEVEL_ORDER[b.level];
    if (la !== lb) return la - lb;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.title.localeCompare(b.title);
  });
}

/** Convenience: compute → filter → rank in one step. */
export function buildBrief(
  state: AppState,
  feedback: AppState["feedback"] = state.feedback,
): Signal[] {
  return rankSignals(applyFeedback(computeBrief(state), feedback));
}

// portfolio summary helper
export interface BriefSummary {
  counts: Record<AttentionLevel, number>;
  highest: Signal | null;
  totalSignals: number;
  hidden: number; // how many signals feedback suppressed
}

export function summarize(ranked: Signal[], hidden: number = 0): BriefSummary {
  const counts: Record<AttentionLevel, number> = {
    ACT_NOW: 0,
    REVIEW: 0,
    OPPORTUNITY: 0,
    HEALTHY: 0,
  };
  for (const s of ranked) counts[s.level]++;
  const totalSignals = ranked.length + hidden;
  return { counts, highest: ranked[0] ?? null, totalSignals, hidden };
}
