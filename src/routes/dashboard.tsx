import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  StoreProvider,
  useStore,
} from "~/lib/useStore";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import AppShell from "~/components/AppShell";
import {
  type AppState,
  type Item,
  type ItemStatus,
  type ItemType,
  type Platform,
  type Product,
  ITEM_STATUSES,
  ITEM_TYPES,
  PLATFORMS,
  buildSuggestions,
  detectDuplicates,
  doneItems,
  hasScanItem,
  itemsByProduct,
  openItems,
  platformLabel,
  typeBadge,
  typeLabel,
} from "~/lib/store";
import {
  type AvailabilityResult,
} from "~/lib/checkAvailability";
import {
  scanSite,
  severityToItemType,
  type Confidence,
  type ScanFinding,
  type ScanResult,
} from "~/lib/scanClient";
import {
  type DiffKind,
  type ObservedIssue,
  type ProductScanHistory,
  diffCounts,
  lastDiffs,
  timeAgo,
} from "~/lib/observation";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="today">
          <Dashboard />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

/* ---------- small UI bits ---------- */

function StatusBadge({ status }: { status: ItemStatus }) {
  const cls =
    status === "open"
      ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
      : status === "in_progress"
        ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

/* ---------- Add / edit item form ---------- */

function ItemForm({
  productId,
  initial,
  onSave,
  onCancel,
}: {
  productId: string;
  initial?: Item;
  onSave: (data: {
    productId: string;
    type: ItemType;
    title: string;
    description?: string;
    status: ItemStatus;
  }) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<ItemType>(initial?.type ?? "feature");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ItemStatus>(initial?.status ?? "open");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    onSave({
      productId,
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      status,
    });
    if (!initial) {
      setTitle("");
      setDescription("");
      setStatus("open");
      setType("feature");
    }
    setError("");
  };

  const input =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800";
  return (
    <form onSubmit={submit} className="silhat-panel space-y-3 border-cyan-900/50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ItemType)}
            className={`${input} mt-1`}
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:col-span-2">
          Title *
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Add Stripe checkout"
            className={`${input} mt-1`}
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
        Description (optional)
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${input} mt-1`}
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ItemStatus)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
          >
            {ITEM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="rounded-lg bg-cyan-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            {initial ? "Save" : "Add item"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </form>
  );
}

/* ---------- Automatic observation (Phase 1) ---------- */

// Phase 2 — consistent CRITICAL/HIGH/MEDIUM/LOW severity model. Tones follow an
// urgency gradient: CRITICAL/HIGH = red, MEDIUM = amber, LOW = slate/cyan.
const SEV_TONE: Record<ScanFinding["severity"], string> = {
  CRITICAL:
    "bg-rose-600 text-white dark:bg-rose-600 dark:text-white",
  HIGH: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  MEDIUM:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  LOW: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
};
const SEV_LABEL: Record<ScanFinding["severity"], string> = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
};

const CONF_TONE: Record<Confidence, string> = {
  HIGH: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  MEDIUM: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  LOW: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function CheckPill({ status }: { status: ScanFinding["status"] }) {
  const cfg =
    status === "ok"
      ? { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", label: "Pass" }
      : status === "unchecked"
        ? { cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", label: "Couldn't check" }
        : { cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", label: "Issue" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// -------- live scan status + differentials (grounded ONLY in real scans) --------

type LiveState = "updating" | "live" | "unavailable" | "none";

function liveStatus(
  history: ProductScanHistory | undefined,
  scanning: boolean,
): { state: LiveState; lastGoodAt?: number } {
  if (scanning) return { state: "updating" };
  if (!history || !history.lastAttempt) return { state: "none" };
  // A failed attempt means we can't confirm the site is healthy right now — but
  // we still have the last-known-good scan to lean on.
  if (history.consecutiveFailures > 0) {
    return { state: "unavailable", lastGoodAt: history.lastGood?.scannedAt };
  }
  if (history.lastGood) return { state: "live", lastGoodAt: history.lastGood.scannedAt };
  return { state: "none" };
}

function LiveStatusDot({ state }: { state: LiveState }) {
  if (state === "none") return null;
  const cfg =
    state === "updating"
      ? { dot: "bg-amber-400 animate-pulse", label: "Updating…" }
      : state === "live"
        ? { dot: "bg-emerald-500", label: "Live" }
        : { dot: "bg-rose-500", label: "Scan unavailable" };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden />
      <span className="text-gray-400">{cfg.label}</span>
    </span>
  );
}

const DIFF_TONE: Record<DiffKind, string> = {
  NEW: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  RESOLVED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  PERSISTING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  REGRESSED: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  IMPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};
const DIFF_LABEL: Record<DiffKind, string> = {
  NEW: "New",
  RESOLVED: "Resolved",
  PERSISTING: "Persisting",
  REGRESSED: "Regressed",
  IMPROVED: "Improved",
};

// A compact per-product "what changed" line built from the latest scan transition.
function WhatChangedLine({ history }: { history: ProductScanHistory | undefined }) {
  const diffs = lastDiffs(history);
  const cc = diffCounts(diffs);
  const parts: { n: number; k: DiffKind }[] = [
    { n: cc.NEW, k: "NEW" },
    { n: cc.REGRESSED, k: "REGRESSED" },
    { n: cc.RESOLVED, k: "RESOLVED" },
    { n: cc.PERSISTING, k: "PERSISTING" },
    { n: cc.IMPROVED, k: "IMPROVED" },
  ].filter((x) => x.n > 0);
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span className="text-gray-500">Scan diff:</span>
      {parts.map((x) => (
        <span
          key={x.k}
          className={`rounded-full px-2 py-0.5 font-semibold ${DIFF_TONE[x.k]}`}
        >
          {x.n} {DIFF_LABEL[x.k].toLowerCase()}
        </span>
      ))}
    </div>
  );
}

// -------- site scan panel (reads persisted observation history) --------

function ScanPanel({
  product,
  scanning,
  onScan,
}: {
  product: Product;
  scanning: boolean;
  onScan: () => void;
}) {
  const { state, actions } = useStore();
  const history = (state.scanHistory ?? {})[product.id];
  const lastResult = history?.lastGood;
  const diffs = lastDiffs(history);
  const diffMap = new Map<string, DiffKind>();
  for (const d of diffs) if (d.kind !== "IMPROVED") diffMap.set(d.stableKey, d.kind);
  const occMap = new Map<string, ObservedIssue>();
  if (history?.issues) for (const i of Object.values(history.issues)) occMap.set(i.stableKey, i);

  const items = itemsByProduct(state.items, product.id);
  const issues = lastResult?.findings.filter((f) => f.status === "fail") ?? [];
  const passed = lastResult?.findings.filter((f) => f.status === "ok") ?? [];
  const unchecked = lastResult?.findings.filter((f) => f.status === "unchecked") ?? [];

  const add = (f: ScanFinding, issue?: ObservedIssue) => {
    actions.addItem({
      productId: product.id,
      type: severityToItemType(f.severity),
      title: issue?.title ?? f.title,
      description: `From site scan — ${issue?.detail ?? f.detail}`,
      status: "open",
      scanKey: f.stableKey,
    });
  };

  // A scan previously failed and there's no known-good data: say so plainly.
  const unavailable =
    history && history.consecutiveFailures > 0 && !history.lastGood;

  return (
    <div className="border-b border-gray-800 bg-gray-900/40 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Site observation
        </h4>
        <div className="flex items-center gap-2">
          {lastResult && lastResult.ok && (
            <span className="text-xs text-gray-400">
              scanned {lastResult.url} · {timeAgo(lastResult.scannedAt)}
            </span>
          )}
          <button
            onClick={onScan}
            disabled={scanning}
            className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scanning ? "Scanning…" : "Scan site"}
          </button>
        </div>
      </div>

      {scanning && (
        <p className="text-sm text-gray-500">
          Fetching {product.url} and checking links, tags, and assets…
        </p>
      )}

      {unavailable && (
        <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          The site couldn't be reached on the latest scan — no checks could run
          and no findings are shown.{" "}
          {history?.lastGood ? (
            <span className="text-gray-400">
              Last known-good scan was {timeAgo(history.lastGood.scannedAt)}.
            </span>
          ) : (
            <span className="text-gray-400">No successful scan yet.</span>
          )}{" "}
          <button
            onClick={onScan}
            disabled={scanning}
            className="ml-1 font-semibold text-rose-200 underline underline-offset-2 hover:text-white disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {!scanning && !unavailable && lastResult && lastResult.ok && issues.length === 0 && (
        <p className="text-sm text-gray-500">No issues detected.</p>
      )}

      {!scanning && !unavailable && issues.length > 0 && (
        <ul className="space-y-2">
          {issues.map((f) => {
            const issue = occMap.get(f.stableKey);
            const added = hasScanItem(items, product.id, f.stableKey);
            const diff = diffMap.get(f.stableKey);
            return (
              <li
                key={f.stableKey}
                className="relative flex items-start justify-between gap-3 overflow-hidden rounded-xl border border-rose-900/50 bg-rose-950/15 p-3"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-rose-500 to-rose-800"
                />
                <div className="min-w-0 pl-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${SEV_TONE[f.severity]}`}
                    >
                      {SEV_LABEL[f.severity]}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONF_TONE[f.confidence]}`}
                      title={
                        f.confidence === "HIGH"
                          ? "Directly observed"
                          : f.confidence === "MEDIUM"
                            ? "Observed, partly inferred"
                            : "Heuristic / indicator — treat as a hint"
                      }
                    >
                      {f.confidence} confidence
                    </span>
                    {diff && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${DIFF_TONE[diff]}`}>
                        {DIFF_LABEL[diff]}
                      </span>
                    )}
                    <p className="text-sm font-medium">{f.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{f.detail}</p>
                  {issue && issue.occurrences > 1 && (
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      Detected {issue.occurrences}× since{" "}
                      {new Date(issue.firstDetectedAt).toLocaleDateString()} — one
                      persistent issue, not duplicates.
                    </p>
                  )}
                  {f.url && (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block truncate text-xs text-cyan-600 hover:underline dark:text-cyan-400"
                    >
                      {f.url}
                    </a>
                  )}
                </div>
                {added ? (
                  <span className="shrink-0 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    Added
                  </span>
                ) : (
                  <button
                    onClick={() => add(f, issue)}
                    className="shrink-0 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
                  >
                    Add
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!scanning && !unavailable && lastResult && lastResult.ok && (
        <>
          {passed.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {passed.length} check{passed.length > 1 ? "s" : ""} passed
              </summary>
              <ul className="mt-2 space-y-1">
                {passed.map((f) => (
                  <li key={f.stableKey} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <CheckPill status="ok" />
                    <span>{f.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {unchecked.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-amber-600 dark:text-amber-400">
                {unchecked.length} check{unchecked.length > 1 ? "s" : ""} couldn't be checked
              </summary>
              <ul className="mt-2 space-y-1">
                {unchecked.map((f) => (
                  <li key={f.stableKey} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <CheckPill status="unchecked" />
                    <span>{f.title}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Product card ---------- */

function ProductCard({
  product,
  scanning,
  onScan,
}: {
  product: Product;
  scanning: boolean;
  onScan: () => void;
}) {
  const { state, actions } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editPlatform, setEditPlatform] = useState<Platform>(product.platform);
  const [editUrl, setEditUrl] = useState(product.url);
  const [editError, setEditError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const history = (state.scanHistory ?? {})[product.id];
  const live = liveStatus(history, scanning);

  const items = itemsByProduct(state.items, product.id);
  const open = openItems(items);
  const done = doneItems(items);

  return (
    <div className="silhat-panel overflow-hidden">
      <div className="border-b border-gray-800 px-4 py-3">
        {editing ? (
          <div className="space-y-2">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-gray-700 dark:bg-gray-800"
              placeholder="Product name"
            />
            <div className="flex gap-2">
              <select
                value={editPlatform}
                onChange={(e) => setEditPlatform(e.target.value as Platform)}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {platformLabel(p)}
                  </option>
                ))}
              </select>
              <input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                placeholder="https://…"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (editName.trim()) {
                    const dups = detectDuplicates(
                      state,
                      editName,
                      editUrl,
                      product.id,
                    );
                    if (dups.length > 0) {
                      setEditError(
                        dups
                          .map((d) =>
                            d.type === "name"
                              ? `A product named “${d.value}” already exists.`
                              : `The URL “${d.value}” is already used by ${d.productName}.`,
                          )
                          .join(" "),
                      );
                      return;
                    }
                    setEditError("");
                    actions.updateProduct(product.id, {
                      name: editName.trim(),
                      platform: editPlatform,
                      url: editUrl.trim(),
                    });
                  }
                  setEditing(false);
                }}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditError("");
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
            {editError && (
              <p className="text-sm text-rose-600">{editError}</p>
            )}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-lg font-semibold">{product.name}</h3>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                  {platformLabel(product.platform)}
                </span>
              </div>
              {product.url ? (
                <a
                  href={product.url.startsWith("http") ? product.url : `https://${product.url}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-sm text-cyan-600 hover:underline dark:text-cyan-400"
                >
                  {product.url}
                </a>
              ) : (
                <p className="mt-1 text-sm text-gray-400">No URL yet</p>
              )}
              {product.url && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <LiveStatusDot state={live.state} />
                  {live.state === "live" && live.lastGoodAt && (
                    <span className="text-gray-500">
                      Updated {timeAgo(live.lastGoodAt)}
                    </span>
                  )}
                  {live.state === "unavailable" && (
                    <button
                      onClick={onScan}
                      disabled={scanning}
                      className="rounded-full bg-rose-950/60 px-2 py-0.5 font-semibold text-rose-200 ring-1 ring-rose-900/60 hover:bg-rose-900/60 disabled:opacity-60"
                    >
                      {live.lastGoodAt
                        ? `Retry (last good ${timeAgo(live.lastGoodAt)})`
                        : "Retry scan"}
                    </button>
                  )}
                  <WhatChangedLine history={history} />
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {open.length > 0 && (
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                  {open.length} open
                </span>
              )}
              {product.url && (
                <button
                  onClick={() => setShowScan((v) => !v)}
                  title="Scan the live site for objective issues"
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    showScan
                      ? "bg-cyan-600 text-white hover:bg-cyan-500"
                      : "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300 dark:hover:bg-cyan-900"
                  }`}
                >
                  Scan site
                </button>
              )}
              <button
                title="Edit product"
                onClick={() => setEditing(true)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </button>
              <button
                title="Delete product"
                onClick={() => {
                  if (confirmDelete) actions.deleteProduct(product.id);
                  else {
                    setConfirmDelete(true);
                    setTimeout(() => setConfirmDelete(false), 2500);
                  }
                }}
                className={`rounded-lg p-1.5 hover:bg-rose-50 ${
                  confirmDelete
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                    : "text-gray-400 hover:text-rose-600"
                }`}
              >
                {confirmDelete ? (
                  <span className="px-1 text-xs font-semibold">Confirm?</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {showScan && product.url && (
        <ScanPanel product={product} scanning={scanning} onScan={onScan} />
      )}

      {/* Checklist */}
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="silhat-eyebrow">Checklist</h4>
          <span className="text-xs text-gray-400">
            {done.length}/{items.length} done
          </span>
        </div>

        {open.length === 0 && done.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-400">
            No items yet — add the first one below.
          </p>
        )}

        <ul className="space-y-2">
          {[...open, ...done].map((item) => {
            const checked = item.status === "done";
            return (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  checked
                    ? "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900/70"
                }`}
              >
                <button
                  onClick={() => {
                    actions.setItemStatus(
                      item.id,
                      checked ? "open" : "done",
                    );
                  }}
                  aria-label={checked ? "Mark as not done" : "Mark as done"}
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${
                    checked
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-gray-300 hover:border-emerald-400 dark:border-gray-600"
                  }`}
                >
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm ${checked ? "text-gray-400 line-through" : "font-medium"}`}
                    >
                      {item.title}
                    </p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${typeBadge(item.type)}`}>
                      {typeLabel(item.type)}
                    </span>
                    {!checked && <StatusBadge status={item.status} />}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!checked && (
                    <select
                      value={item.status}
                      onChange={(e) =>
                        actions.setItemStatus(item.id, e.target.value as ItemStatus)
                      }
                      className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800"
                    >
                      {ITEM_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => actions.deleteItem(item.id)}
                    title="Delete item"
                    className="rounded p-1 text-gray-300 hover:text-rose-600"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {showAdd ? (
          <div className="mt-4">
            <ItemForm
              productId={product.id}
              onSave={(data) => {
                actions.addItem(data);
                setShowAdd(false);
              }}
              onCancel={() => setShowAdd(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 hover:border-cyan-400 hover:text-cyan-600 dark:border-gray-700 dark:hover:border-cyan-500"
          >
            <span className="text-lg leading-none">+</span> Add issue / feature / bug
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Add product form ---------- */

function AddProductForm() {
  const { state, actions } = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<Platform>("vercel");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityResult | null>(null);

  const duplicates =
    name.trim() || url.trim() ? detectDuplicates(state, name, url) : [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Product name is required");
      return;
    }
    const dups = detectDuplicates(state, name, url);
    if (dups.length > 0) {
      setError(markDups(dups));
      return;
    }
    actions.addProduct({
      name: name.trim(),
      platform,
      url: url.trim(),
    });
    setName("");
    setUrl("");
    setPlatform("vercel");
    setError("");
    setAvailability(null);
    setOpen(false);
  };

  const markDups = (dups: { type: "name" | "url"; value: string; productName: string }[]) =>
    dups
      .map((d) =>
        d.type === "name"
          ? `A product named “${d.value}” already exists (${d.productName}).`
          : `The URL “${d.value}” is already used by ${d.productName}.`,
      )
      .join(" ");

  const runCheck = async () => {
    if (!name.trim()) {
      setError("Enter a name to check availability");
      return;
    }
    setError("");
    setChecking(true);
    setAvailability(null);
    try {
      const res = await fetch(
        `/api/check-availability?name=${encodeURIComponent(name.trim())}`,
      );
      const data = (await res.json()) as AvailabilityResult;
      setAvailability(data);
    } catch {
      setAvailability({
        name: name.trim(),
        results: [],
        checkedAt: Date.now(),
      });
    } finally {
      setChecking(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="silhat-btn silhat-btn-primary px-4 py-2"
      >
        <span className="text-base leading-none">+</span> Add product
      </button>
    );
  }

  const input =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800";
  const dup = "border-rose-400 dark:border-rose-600";
  return (
    <form
      onSubmit={submit}
      className="silhat-panel border-cyan-900/50 p-4"
    >
      <h3 className="mb-3 font-semibold">New product</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 sm:col-span-1">
          Name *
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My app"
            className={`${input} mt-1 ${duplicates.some((d) => d.type === "name") ? dup : ""}`}
          />
          {duplicates.some((d) => d.type === "name") && (
            <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">
              Name already in your portfolio
            </span>
          )}
        </label>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className={`${input} mt-1`}
          >
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {platformLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400">
          URL
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            className={`${input} mt-1 ${duplicates.some((d) => d.type === "url") ? dup : ""}`}
          />
          {duplicates.some((d) => d.type === "url") && (
            <span className="mt-1 block text-xs text-rose-600 dark:text-rose-400">
              URL already used in your portfolio
            </span>
          )}
        </label>
      </div>

      {/* Name availability */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Name availability
            {name.trim() && (
              <span className="ml-2 text-gray-400">checking “{name.trim()}”</span>
            )}
          </p>
          <button
            type="button"
            onClick={runCheck}
            disabled={checking || !name.trim()}
            className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {checking ? "Checking…" : "Check availability"}
          </button>
        </div>
        {checking && (
          <p className="mt-2 text-xs text-gray-400">
            Querying npm, GitHub, and domain registries…
          </p>
        )}
        {availability && availability.results.length === 0 && !checking && (
          <p className="mt-2 text-xs text-rose-500">
            Couldn't reach the availability services.
          </p>
        )}
        {availability && availability.results.length > 0 && (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {availability.results.map((r) => (
              <li
                key={r.source}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {r.source}
                </span>
                <StatusChip status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Add product
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function StatusChip({ status }: { status: "available" | "taken" | "error" }) {
  const cls =
    status === "available"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "taken"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  const label = status === "available" ? "Available" : status === "taken" ? "Taken" : "Couldn't check";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

/* ---------- Smart suggestions ---------- */

function Suggestions() {
  const { state } = useStore();
  const suggestions = buildSuggestions(state);
  const upcoming = suggestions.filter((s) => s.kind === "upcoming");
  const cross = suggestions.filter((s) => s.kind === "cross");

  const card = (items: typeof suggestions) =>
    items.length === 0 ? (
      <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400 dark:border-gray-800 dark:bg-gray-800/40">
        Nothing to flag right now. Add items to see suggestions.
      </p>
    ) : (
      <ul className="space-y-2">
        {items.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900/70"
          >
            <span
              className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${s.tone}`}
            >
              {s.kind === "cross" ? "Cross-market" : "Flag"}
            </span>
            <div>
              <p className="text-sm font-medium">{s.title}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {s.detail}
              </p>
            </div>
          </li>
        ))}
      </ul>
    );

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight">Smart suggestions</h2>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          rule-based
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Upcoming work
          </h3>
          {card(upcoming)}
        </div>
        <div>
          <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Cross-marketing
          </h3>
          {card(cross)}
        </div>
      </div>
    </section>
  );
}

/* ---------- Dashboard root ---------- */

// Phase 1 — automatic observation. Scans each product that has a URL in the
// background on dashboard load (and when products change), guarding against
// duplicate concurrent scans. Never blocks render; cards render immediately and
// the status dot reflects the live lifecycle.
function useAutoscan() {
  const { state, actions, ready } = useStore();
  const [scanning, setScanning] = useState<Record<string, boolean>>({});
  const inFlight = useRef<Set<string>>(new Set());
  const hasFired = useRef<Set<string>>(new Set());

  const runScanForProduct = useCallback(
    async (productId: string, url: string) => {
      if (!url) return;
      if (inFlight.current.has(productId)) return; // duplicate-guard: never fire twice
      inFlight.current.add(productId);
      setScanning((s) => ({ ...s, [productId]: true }));
      try {
        const res = await scanSite(url);
        if (res) {
          actions.recordScan(productId, res);
        } else {
          // Couldn't reach the scan service itself — record a failed attempt so
          // the product shows "Scan unavailable / Retry" without clobbering the
          // last-known-good scan or fabricating findings.
          actions.recordScan(productId, {
            url,
            requestedUrl: url,
            ok: false,
            scannedAt: Date.now(),
            findings: [],
          });
        }
      } finally {
        inFlight.current.delete(productId);
        setScanning((s) => {
          const next = { ...s };
          delete next[productId];
          return next;
        });
      }
    },
    [actions],
  );

  // Non-blocking auto-scan on refresh: once hydrated, fire once per product.
  useEffect(() => {
    if (!ready) return;
    for (const p of state.products) {
      if (!p.url) continue;
      if (hasFired.current.has(p.id)) continue;
      hasFired.current.add(p.id);
      void runScanForProduct(p.id, p.url);
    }
  }, [ready, state.products, runScanForProduct]);

  return { scanning, runScanForProduct };
}

// Clearly-labeled SAMPLE overview for anonymous visitors. Shows the shape of the
// portfolio view on invented (fictional) data so the value is graspable before
// signup — never the owner's real products.
function DashboardDemo() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-950">
            Demo · sample data
          </span>
          <p className="text-sm text-amber-100">
            This is a <strong>fictional demo</strong> of the portfolio overview —
            sample products and checklists, not your projects. Sign in to see your own.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="silhat-eyebrow">Today · Signals</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
            Portfolio overview
          </h1>
          <p className="mt-1 text-sm text-gray-400">
            Every product, checklist, and detected signal — in one place.
          </p>
        </div>
      </div>

      <div className="silhat-panel overflow-hidden opacity-90">
        <div className="border-b border-gray-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-lg font-semibold">Acme Launchpad (Sample)</h3>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              Sample SaaS
            </span>
          </div>
          <a
            className="mt-1 block truncate text-sm text-cyan-600 hover:underline dark:text-cyan-400"
          >
            https://acme-launchpad.example.com
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              <span className="text-gray-400">Live (sample)</span>
            </span>
            <span className="text-gray-500">Updated just now (sample)</span>
          </div>
        </div>
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="silhat-eyebrow">Checklist</h4>
            <span className="text-xs text-gray-400">3/5 done (sample)</span>
          </div>
          <ul className="space-y-2">
            {[
              { t: "Wire up checkout + billing flow", d: true },
              { t: "Harden onboarding", d: true },
              { t: "Set up analytics", d: true },
              { t: "Add Stripe test mode", d: false },
              { t: "Draft launch page", d: false },
            ].map((i) => (
              <li
                key={i.t}
                className={`flex items-start gap-3 rounded-xl border p-3 ${
                  i.d
                    ? "border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    : "border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900/70"
                }`}
              >
                <span
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 ${
                    i.d
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {i.d && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <p className={`text-sm ${i.d ? "text-gray-400 line-through" : "font-medium"}`}>
                  {i.t}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="silhat-panel border-dashed px-6 py-8 text-center">
        <p className="text-lg font-semibold text-gray-100">See your own portfolio</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-400">
          Your real products, checklists, and live scan signals — private to your account.
        </p>
        <Link
          to="/login"
          className="silhat-btn silhat-btn-primary mt-5 inline-flex items-center rounded-xl px-5 py-2.5"
        >
          Log in / Sign up
        </Link>
      </div>
    </div>
  );
}

function Dashboard() {
  const { user, loading } = useAuth();
  const { state, ready, actions } = useStore();
  const [showReset, setShowReset] = useState(false);
  const { scanning, runScanForProduct } = useAutoscan();

  // Account-scoped gate: the portfolio is the owner's private data. While auth
  // is resolving we show a neutral loading state; an unauthenticated client gets
  // a CLEARLY-LABELED demo (sample) overview — never the owner's products.
  if (loading) {
    return <p className="py-20 text-center text-gray-500">Loading…</p>;
  }
  if (!user) {
    return <DashboardDemo />;
  }

  return (
    <div className="space-y-6">
      {!ready ? (
        <p className="py-20 text-center text-gray-500">Loading…</p>
      ) : (
        <>
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="silhat-eyebrow">Today · Signals</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
                Portfolio overview
              </h1>
              <p className="mt-1 text-sm text-gray-400">
                Every product, checklist, and detected signal — in one place.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  if (showReset) {
                    actions.resetData();
                    setShowReset(false);
                  } else {
                    setShowReset(true);
                    setTimeout(() => setShowReset(false), 2500);
                  }
                }}
                className={`silhat-btn ${
                  showReset ? "bg-rose-600 text-white" : "silhat-btn-ghost"
                }`}
              >
                {showReset ? "Confirm reset?" : "Reset demo data"}
              </button>
              <AddProductForm />
            </div>
          </section>

          {state.products.length === 0 ? (
            <div className="silhat-panel border-dashed px-6 py-16 text-center">
              <p className="text-lg font-semibold text-gray-200">No products yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Add your first product to start your checklist.
              </p>
            </div>
          ) : (
            <>
              <Suggestions />
              <div className="grid gap-5 xl:grid-cols-2">
                {state.products.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    scanning={!!scanning[p.id]}
                    onScan={() => runScanForProduct(p.id, p.url)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// Ensure AppState type is referenced (used in signatures elsewhere if needed)
export type { AppState };
