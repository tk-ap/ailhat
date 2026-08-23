// React hook that wires the pure opportunity engine to the store.
// Computes ranked, feedback-filtered opportunities from current scan state
// (client-only; store loads from localStorage after mount). No browser globals
// at import.

import { useEffect, useMemo } from "react";
import { useStore } from "./useStore";
import {
  type FeedbackKind,
  type Opportunity,
  buildOpportunities,
  computeOpportunities,
} from "./opportunity";
import { hasScanItem } from "./store";

export interface UseOpportunities {
  all: Opportunity[]; // computed, before feedback filtering (for the "hidden" count)
  opportunities: Opportunity[]; // ranked + feedback-filtered, ready to render
  hidden: number;
  opportunityCount: number;
  feedback: (oppId: string, kind: FeedbackKind) => void;
  // Create a checklist item for an opportunity, deduped by its stable id
  // (reused as the scanKey so re-adding never duplicates).
  createTask: (opp: Opportunity) => { added: number; skipped: number };
}

export function useOpportunities(): UseOpportunities {
  const { state, actions } = useStore();

  const all = useMemo(() => computeOpportunities(state), [state]);
  const opportunities = useMemo(
    () => buildOpportunities(state, state.opportunityFeedback),
    // state is captured via buildOpportunities(state) → feed feedback explicitly
    [all, state],
  );

  // Persist the derived list into state (localStorage + server jsonb) so Phase 5
  // and cross-session use have a durable copy. Guarded by a signature equality
  // check so a no-op recompute never triggers another write (and no save loop).
  useEffect(() => {
    const persist = opportunitiesAt(all);
    const current = opportunitiesAt(state.opportunities);
    if (persist !== current) {
      actions.setOpportunities(all);
    }
  }, [all, state.opportunities, actions]);

  const hidden = Math.max(0, all.length - opportunities.length);

  const feedback = (oppId: string, kind: FeedbackKind) =>
    actions.setOpportunityFeedback(oppId, kind);

  const createTask = (opp: Opportunity) => {
    const already = hasScanItem(state.items, opp.productId, opp.id);
    if (already) {
      return { added: 0, skipped: 1 };
    }
    actions.addItem({
      productId: opp.productId,
      type: "feature",
      title: opp.title,
      description: `Opportunity — ${opp.action} Evidence: ${opp.evidence.join(" · ")}`,
      status: "open",
      scanKey: opp.id, // stable → dedupes create-task across renders
    });
    return { added: 1, skipped: 0 };
  };

  return {
    all,
    opportunities,
    hidden,
    opportunityCount: all.length,
    feedback,
    createTask,
  };
}

/** Compact signature for equality comparison — only ids + scores matter. */
function opportunitiesAt(opps: Opportunity[]): string {
  return opps
    .map((o) => `${o.id}:${o.score}:${o.status}`)
    .sort()
    .join("|");
}
