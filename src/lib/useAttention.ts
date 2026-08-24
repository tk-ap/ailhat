// React hook that wires the pure Phase-5 Attention Engine to the store.
// Exposes the ranked "WHAT SHOULD I DO NEXT?" feed + capacity/next-window signals
// + feedback actions that target a stable source id. Client-only (store loads
// from localStorage after mount). No browser globals at import.

import { useMemo } from "react";
import { useStore } from "./useStore";
import type { FeedbackKind } from "./store";
import { hasScanItem } from "./store";
import {
  type AttentionItem,
  type CapacitySignals,
  buildAttention,
  computeAttention,
} from "./attention";
import { PORTFOLIO_ID } from "./marketGap";

export interface UseAttention {
  items: AttentionItem[]; // ranked + capacity/feedback weighted, ready to render
  allCount: number; // total computed before feedback filtering/hiding
  hidden: number;
  capacity: CapacitySignals;
  feedback: (item: AttentionItem, kind: FeedbackKind) => void;
  /** Create a checklist item for an attention item (deduped by scanKey). */
  createTask: (item: AttentionItem) => { added: number; skipped: number };
}

export function useAttention(): UseAttention {
  const { state, actions } = useStore();

  const { items, capacity } = useMemo(() => buildAttention(state), [state]);
  const allCount = useMemo(() => computeAttention(state).length, [state]);

  const hidden = Math.max(0, allCount - items.length);

  const feedback = (item: AttentionItem, kind: FeedbackKind) => {
    if (item.source === "OPPORTUNITY" || item.source === "MARKET_GAP") {
      actions.setOpportunityFeedback(item.id, kind);
    } else {
      actions.setFeedback(item.id, kind);
    }
  };

  const createTask = (item: AttentionItem) => {
    // For portfolio-level gaps, anchor the task to a real product so it lands on
    // a visible checklist (same behaviour as the market-gap section).
    let productId = item.productId;
    if (item.productId === PORTFOLIO_ID && state.products.length > 0) {
      productId = state.products[0].id;
    }
    const key = item.scanKey ?? item.id;
    const already = hasScanItem(state.items, productId, key);
    if (already) {
      return { added: 0, skipped: 1 };
    }
    actions.addItem({
      productId,
      type: item.recType ?? "feature",
      title: item.title,
      description: `Attention · ${item.action} Evidence: ${item.evidence.join(" · ")}`,
      status: "open",
      scanKey: key, // stable → dedupes create-task across renders
    });
    return { added: 1, skipped: 0 };
  };

  return {
    items,
    allCount,
    hidden,
    capacity,
    feedback,
    createTask,
  };
}
