// Phase 5 — Attention Engine UI. Renders the unified, ranked "WHAT SHOULD I DO
// NEXT?" feed at the top of the Intelligence surface (/brief). Unifies bugs +
// risks + opportunities + market gaps into one attention feed, each item
// attention-classed (ACT NOW / REVIEW / OPPORTUNITY / HEALTHY) with evidence +
// reasoning + a recommendation (score + confidence) + a concrete action, plus a
// feedback loop (Fix/Create task · Investigate · Snooze · Dismiss · Mark
// incorrect) that personalises future prioritisation. Sits above Opportunities
// and Market gaps. Dark command-center aesthetic — Ailhat identity only, NO
// purple (dark neutral + electric cyan + blue signal, #7fb0ff accent).
import { useState } from "react";
import { useAttention } from "~/lib/useAttention";
import {
  type AttentionItem,
  type AttentionClass,
  ATTENTION_BORDER,
  ATTENTION_CLASSES,
  ATTENTION_DOT,
  ATTENTION_LABELS,
  ATTENTION_TONE,
} from "~/lib/attention";
import { CONF_TONE, TYPE_LABELS, TYPE_TONE } from "~/lib/opportunity";
import type { OpportunityType } from "~/lib/opportunity";

/** Small pill used across the card. */
function Pill({ text, tone }: { text: string; tone: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {text}
    </span>
  );
}

function classCounts(items: AttentionItem[]) {
  const counts = new Map<AttentionClass, number>();
  for (const c of ATTENTION_CLASSES) counts.set(c, 0);
  for (const it of items) counts.set(it.attentionClass, (counts.get(it.attentionClass) ?? 0) + 1);
  return counts;
}

/* -------------------- Capacity / Next-window header -------------------- */

function CapacityHeader() {
  const { capacity, items } = useAttention();
  const pct = Math.round(capacity.capacity * 100);
  // gauge colour: cyan (high capacity) → amber (mid) → rose (busy)
  const gauge =
    pct >= 60
      ? "bg-cyan-500"
      : pct >= 30
        ? "bg-amber-500"
        : "bg-rose-500";
  const label =
    pct >= 60
      ? "Plenty of room"
      : pct >= 30
        ? "Moderately busy"
        : "Attention is tight";

  return (
    <div className="silhat-panel p-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {/* Capacity gauge */}
        <div className="min-w-[180px]">
          <div className="flex items-center justify-between">
            <p className="silhat-eyebrow">Operating capacity</p>
            <span className={`text-sm font-bold ${pct >= 60 ? "text-cyan-400" : pct >= 30 ? "text-amber-400" : "text-rose-400"}`}>
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
            <div className={`h-2 rounded-full ${gauge}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">{label}</p>
        </div>

        {/* Signals that grounds the capacity */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-gray-500">Products in motion</p>
            <p className="font-semibold text-gray-100">
              {capacity.productsInMotion}
              <span className="text-xs font-medium text-gray-500"> / {capacity.productCount}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Open findings</p>
            <p className="font-semibold text-gray-100">{capacity.openFindings}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Open checklist items</p>
            <p className="font-semibold text-gray-100">{capacity.openItems}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Attention committed</p>
            <p className="font-semibold text-gray-100">
              {Math.round(capacity.allocatedSpend * 100)}%
            </p>
          </div>
        </div>
      </div>

      {/* Next window worth spending on */}
      {capacity.nextWindowLabel ? (
        <p className="mt-4 rounded-lg bg-cyan-950/30 px-4 py-2.5 text-sm ring-1 ring-cyan-900/50">
          <span className="font-semibold text-cyan-300">Next window worth spending on: </span>
          <span className="text-gray-200">{capacity.nextWindowLabel}</span>
        </p>
      ) : (
        <p className="mt-4 rounded-lg bg-gray-900 px-4 py-2.5 text-sm text-gray-400 ring-1 ring-gray-800">
          No items demanding attention right now — your next window is free.
        </p>
      )}

      {/* Class summary */}
      <div className="mt-4 flex flex-wrap gap-2">
        {ATTENTION_CLASSES.map((c) => {
          const n = classCounts(items).get(c) ?? 0;
          return (
            <span key={c} className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${ATTENTION_TONE[c]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${ATTENTION_DOT[c]}`} />
              {ATTENTION_LABELS[c]} · {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------- Individual attention card -------------------- */

function kindTone(item: AttentionItem): string {
  if (item.source === "BUG") return "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300";
  if (item.source === "RISK") return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
  return TYPE_TONE[item.kind as OpportunityType] ?? TYPE_TONE.FEATURE;
}

function kindLabel(item: AttentionItem): string {
  if (item.source === "BUG" || item.source === "RISK") return item.source;
  return TYPE_LABELS[item.kind as OpportunityType] ?? "Opportunity";
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const { feedback, createTask } = useAttention();
  const [note, setNote] = useState("");

  const meta = {
    label: ATTENTION_LABELS[item.attentionClass],
    tone: ATTENTION_TONE[item.attentionClass],
    dot: ATTENTION_DOT[item.attentionClass],
  };

  const doCreate = () => {
    const { added, skipped } = createTask(item);
    feedback(item, "acted");
    setNote(
      added > 0
        ? `✓ Added to checklist${item.productName ? ` (${item.productName})` : ""}`
        : skipped > 0
          ? `${item.title} is already on the checklist`
          : "✓ Marked",
    );
  };

  const doInvestigate = () => {
    feedback(item, "more");
    setNote("Marked for investigation — we'll keep it and learn from your focus.");
  };

  const doSnooze = () => {
    feedback(item, "snoozed");
    setNote("Snoozed for a day — we'll resurface it later.");
  };

  const doDismiss = () => {
    feedback(item, "dismissed");
    setNote("Dismissed — we'll stop surfacing this.");
  };

  const doWrong = () => {
    feedback(item, "wrong");
    setNote("Marked incorrect — we'll rank this lower in future.");
  };

  return (
    <article className={`silhat-panel ${ATTENTION_BORDER[item.attentionClass]}`}>
      <div className="p-5">
        {/* Top row: attention class + source kind + severity/bucket + score */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${meta.tone}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <Pill text={kindLabel(item)} tone={kindTone(item)} />
          {item.severity && (
            <Pill text={item.severity} tone="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200" />
          )}
          {item.effortLabel && (
            <Pill text={`${item.effortLabel} effort`} tone="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" />
          )}
          <Pill text={`${item.confidence} confidence`} tone={CONF_TONE[item.confidence]} />
          <span className="ml-auto font-mono text-lg font-bold text-gray-100">
            {item.score}
            <span className="text-xs font-medium text-gray-500">/100</span>
          </span>
        </div>

        <h3 className="mt-3 text-lg font-bold leading-snug">{item.title}</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {item.description}
        </p>
        {item.productName && (
          <p className="mt-2">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {item.productName}
            </span>
          </p>
        )}

        {/* Evidence → Reasoning → Recommendation */}
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Evidence</dt>
            <dd className="mt-1 space-y-1">
              {item.evidence.map((e, idx) => (
                <p key={idx} className="flex gap-2 text-gray-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-600" />
                  {e}
                </p>
              ))}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Reasoning</dt>
            <dd className="mt-1 text-gray-300">{item.reasoning}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Recommendation</dt>
            <dd className="mt-1 rounded-lg bg-gray-900 px-3 py-2 ring-1 ring-gray-800">
              <span className="font-semibold text-cyan-300">Recommendation: </span>
              <span className="text-gray-100">{item.recommendation}</span>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Action</dt>
            <dd className="mt-1 text-gray-300">{item.action}</dd>
          </div>
        </dl>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={doCreate} className="silhat-btn silhat-btn-primary">
            {item.source === "BUG" || item.source === "RISK" ? "Fix" : "Create task"}
          </button>
          <button onClick={doInvestigate} className="silhat-btn silhat-btn-ghost">
            Investigate
          </button>
          <button onClick={doSnooze} className="silhat-btn silhat-btn-ghost">
            Snooze
          </button>
          <button onClick={doDismiss} className="silhat-btn silhat-btn-ghost">
            Dismiss
          </button>
          <button onClick={doWrong} className="silhat-btn silhat-btn-ghost">
            Mark incorrect
          </button>
        </div>
        {note && (
          <p className="mt-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{note}</p>
        )}
      </div>
    </article>
  );
}

/* -------------------- Full section -------------------- */

export default function AttentionSection() {
  const { items, hidden, capacity } = useAttention();

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <p className="silhat-eyebrow text-cyan-300">Intelligence · Attention engine</p>
      </div>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
        What should I do next?
      </h1>
      <p className="mt-1 text-sm text-gray-400">
        One ranked feed across every product — bugs, risks, opportunities and
        market gaps — grounded in evidence, weighted by your available capacity.
      </p>

      {hidden > 0 && (
        <p className="mt-3 text-xs text-gray-500">
          {hidden} item{hidden > 1 ? "s" : ""} hidden by your feedback.
        </p>
      )}

      <div className="mt-4 space-y-5">
        <CapacityHeader />

        {items.length === 0 ? (
          <div className="silhat-panel border-dashed px-6 py-16 text-center">
            <p className="text-lg font-semibold text-gray-200">
              Nothing needs attention right now
            </p>
            <p className="mt-1 text-sm text-gray-400">
              No open findings, opportunities or gaps across {capacity.productCount}{" "}
              product{capacity.productCount === 1 ? "" : "s"}. Your next window is free.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {items.map((it) => (
              <AttentionCard key={it.id} item={it} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
