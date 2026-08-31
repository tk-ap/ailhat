// React hook that wires the pure brief engine to the store.
// Computes ranked, feedback-filtered signals from current state (client-only;
// store loads from localStorage after mount). No browser globals at import.

import { useMemo } from "react";
import { useStore } from "./useStore";
import {
  type FeedbackKind,
  type Signal,
  buildBrief,
  computeBrief,
  summarize,
} from "./brief";
import { hasScanItem } from "./store";

export interface UseBrief {
  signals: Signal[]; // ranked + feedback-filtered, ready to render
  allSignals: Signal[]; // before feedback filtering (for the "hidden" count)
  summary: ReturnType<typeof summarize>;
  productCount: number;
  feedback: (signalId: string, kind: FeedbackKind) => void;
  expandToChecklist: (signal: Signal) => { added: number; skipped: number };
  activate: (signal: Signal) => void; // performs the signal's actOnItem action
}

export function useBrief(): UseBrief {
  const { state, actions } = useStore();

  const allSignals = useMemo(() => computeBrief(state), [state]);
  const signals = useMemo(() => buildBrief(state), [state]);
  const hidden = Math.max(0, allSignals.length - signals.length);
  const summary = useMemo(
    () => summarize(signals, hidden),
    [signals, hidden],
  );

  const feedback = (signalId: string, kind: FeedbackKind) => {
    // Continuity rule: accepting work is not the same thing as resolving the
    // underlying signal. The previous implementation persisted `acted`, and the
    // brief engine treats acted feedback as suppressing — so a Fix/Act click made
    // the card disappear before the user had a durable place to continue.
    //
    // Actual acceptance is already persisted through checklist/status mutations
    // in expandToChecklist()/activate(). Keep the signal visible until fresh
    // product evidence changes the premise or the user explicitly dismisses,
    // snoozes, marks it handled, or marks it wrong.
    if (kind === "acted") return;
    actions.setFeedback(signalId, kind);
  };

  // Turn a signal's recommended checklist item(s) into real items, deduped.
  const expandToChecklist = (signal: Signal) => {
    let added = 0;
    let skipped = 0;
    for (const rec of signal.recItems) {
      const already = rec.scanKey
        ? hasScanItem(state.items, rec.productId, rec.scanKey)
        : state.items.some(
            (i) =>
              i.productId === rec.productId &&
              i.title.trim().toLowerCase() === rec.title.trim().toLowerCase(),
          );
      if (already) {
        skipped++;
      } else {
        actions.addItem({
          productId: rec.productId,
          type: rec.type,
          title: rec.title,
          description: rec.description,
          status: "open",
          ...(rec.scanKey ? { scanKey: rec.scanKey } : {}),
        });
        added++;
      }
    }
    return { added, skipped };
  };

  // Perform a signal's one-click action that targets an existing item.
  const activate = (signal: Signal) => {
    if (signal.actOnItem) {
      actions.setItemStatus(signal.actOnItem.id, signal.actOnItem.toStatus);
    }
  };

  return {
    signals,
    allSignals,
    summary,
    productCount: state.products.length,
    feedback,
    expandToChecklist,
    activate,
  };
}
