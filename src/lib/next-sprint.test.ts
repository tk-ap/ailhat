import { strict as assert } from "node:assert";
import { computeNextSprint } from "./next-sprint";
import type { AppState } from "./store";

const state: AppState = {
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

const result = computeNextSprint(state, Date.parse("2026-09-21T17:00:00Z"));
assert.equal(result.schema, "ailhat.next-sprint/v1");
assert.equal(result.advisory, true);
assert.equal(result.itemCount, 0);
assert.deepEqual(result.recommendations, []);
assert.equal(result.generatedAt, "2026-09-21T17:00:00.000Z");
