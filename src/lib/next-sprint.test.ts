import { strict as assert } from "node:assert";
import type { AttentionItem } from "./attention";
import {
  buildSprintRecommendations,
  computeNextSprint,
  selectSprintItems,
} from "./next-sprint";
import type { AppState } from "./store";

const state: AppState = {
  products: [
    { id: "p1", name: "ailhat", platform: "vercel", url: "https://ailhat.vercel.app", repository: "tk-ap/ailhat", createdAt: 1 },
  ],
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

const attention = (id: string, status: AttentionItem["status"], score: number): AttentionItem => ({
  id,
  source: "OPPORTUNITY",
  kind: "PRODUCT_IMPROVEMENT",
  productId: "p1",
  productName: "ailhat",
  title: `Item ${id}`,
  description: "Evidence-backed item",
  evidence: [`evidence:${id}`],
  reasoning: `Reason ${id}`,
  recommendation: `Outcome ${id}`,
  action: `Act ${id}`,
  score,
  baseScore: score,
  confidence: "HIGH",
  attentionClass: score >= 80 ? "ACT_NOW" : "REVIEW",
  status,
});

const empty = computeNextSprint({
  ...state,
  products: [],
}, Date.parse("2026-09-21T17:00:00Z"));
assert.equal(empty.schema, "ailhat.next-sprint/v1");
assert.equal(empty.advisory, true);
assert.equal(empty.itemCount, 0);
assert.deepEqual(empty.recommendations, []);
assert.equal(empty.generatedAt, "2026-09-21T17:00:00.000Z");

const ranked = [
  attention("1", "open", 95),
  attention("2", "investigating", 90),
  attention("3", "actioned", 89),
  attention("4", "open", 85),
  attention("5", "dismissed", 84),
  attention("6", "open", 80),
  attention("7", "open", 70),
  attention("8", "open", 60),
];
const selected = selectSprintItems(ranked, 5);
assert.deepEqual(selected.map((item) => item.id), ["1", "2", "4", "6", "7"]);

const recommendations = buildSprintRecommendations(state, selected);
assert.deepEqual(recommendations.map((item) => item.rank), [1, 2, 3, 4, 5]);
assert.equal(recommendations[0].product.repository, "tk-ap/ailhat");
assert.deepEqual(recommendations[0].evidence, ["evidence:1"]);
assert.match(recommendations[0].whyNow, /Reason 1/);
assert.match(recommendations[0].verification, /Independent verification/);

// Recommendation mapping is deterministic for the same evidence-ordered input.
assert.deepEqual(buildSprintRecommendations(state, selected), recommendations);
