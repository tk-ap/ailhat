// React hook that wires the pure market-gap engine to the store.
// Client-only (store loads from localStorage after mount). No browser globals at
// import. Mirrors useOpportunities but for portfolio-level MARKET/COMPETITIVE
// gaps (Phase 4).

import { useMemo } from "react";
import { useStore } from "./useStore";
import type { FeedbackKind } from "./store";
import {
  type MarketGapOpportunity,
  PORTFOLIO_ID,
  buildMarketGaps,
  computeMarketGaps,
} from "./marketGap";
import { hasScanItem } from "./store";

export interface UseMarketGaps {
  all: MarketGapOpportunity[]; // computed, before feedback filtering
  gaps: MarketGapOpportunity[]; // ranked + feedback-filtered, ready to render
  hidden: number;
  gapCount: number;
  feedback: (gapId: string, kind: FeedbackKind) => void;
  /** First real product to anchor a "bridge" task; null if portfolio is empty. */
  anchorProductId: string | null;
  // Create a checklist item for a market gap, anchored to a real product so it
  // lands on a visible checklist (portfolio gaps are not per-product). Deduped
  // by the gap's stable id.
  createTask: (gap: MarketGapOpportunity) => { added: number; skipped: number };
}

export function useMarketGaps(): UseMarketGaps {
  const { state, actions } = useStore();

  const all = useMemo(() => computeMarketGaps(state), [state]);
  const gaps = useMemo(
    () => buildMarketGaps(state, state.opportunityFeedback),
    [state],
  );

  // Persist a durable copy only exists if the brief already computes opportunities;
  // market gaps are recomputed live, so nothing extra to persist beyond feedback.
  // (Listed to keep parity with useOpportunities' derive→persist shape.)

  const hidden = Math.max(0, all.length - gaps.length);

  const feedback = (gapId: string, kind: FeedbackKind) =>
    actions.setOpportunityFeedback(gapId, kind);

  const anchorProductId = useMemo(() => {
    if (!state || state.products.length === 0) return null;
    return state.products[0].id;
  }, [state]);

  const createTask = (gap: MarketGapOpportunity) => {
    // Anchor to a real product when possible so the task is visible in a
    // product's checklist; otherwise fall back to the portfolio root.
    const productId = anchorProductId ?? PORTFOLIO_ID;
    const already = hasScanItem(state.items, productId, gap.id);
    if (already) {
      return { added: 0, skipped: 1 };
    }
    actions.addItem({
      productId,
      type: "feature",
      title: gap.title,
      description: `Market gap — ${gap.action} Evidence: ${gap.evidence.join(" · ")}`,
      status: "open",
      scanKey: gap.id, // stable → dedupes create-task across renders
    });
    return { added: 1, skipped: 0 };
  };

  return {
    all,
    gaps,
    hidden,
    gapCount: all.length,
    feedback,
    anchorProductId,
    createTask,
  };
}
