# ailhat workspace composition + product cockpit

## Why this pass exists

The current shell still reflects the original owner-era information architecture:

- sidebar product links go directly to a narrow per-product decisions surface;
- Today renders every active product in raw storage order;
- lifecycle retirement exists, but Today has no explicit composition controls;
- there is no single all-up product surface that gathers the product's current intelligence, scan history, work, decisions, opportunities, and lifecycle state.

This pass reconciles those surfaces around one model:

> Portfolio controls membership and lifecycle. Today controls attention and layout. Intelligence edits the portfolio into a ranked brief. Product Cockpit controls one product in depth. Direct turns an accepted intelligence action into an agent-ready work artifact.

## 1. Portfolio membership vs workspace visibility

These concepts must stay distinct.

### Active

The product is part of the prime Portfolio Intelligence set. It participates in scanning, prioritization, opportunity detection, Direct, and portfolio planning.

### Retired

The product leaves the active intelligence/planning set. Its product-scoped context is archived and reversible. Retirement is not deletion.

### Today visibility

A product can remain active while its Today presentation changes. This is presentation/attention state, not portfolio lifecycle state.

Initial Today presentation states:

- **Expanded** — full Today card.
- **Collapsed** — compact status/signal row, still visible.
- **Hidden from Today** — not rendered on Today, but remains active elsewhere.

Hidden-from-Today must never silently behave like retirement.

## 2. Today as a configurable workspace

Today should no longer mean "all active products in insertion order." It is the user's current operating surface.

### Required controls

For each active product:

- move up
- move down
- collapse / expand
- hide from Today / restore to Today
- open Product Cockpit
- retire product

A later pass can replace up/down with drag-and-drop after keyboard/mobile ordering is proven.

### Ordering

The user's explicit order is authoritative for Today and the active-product sidebar. New active products append to the end unless the user moves them.

Retiring a product removes it from the Today order. Reactivating it appends it to the end by default.

### Workspace manager

Today should expose a compact **Customize workspace** control that reveals:

- ordered active-product list;
- visibility state for each product;
- collapsed/expanded state;
- retired-product count with link to Portfolio Lifecycle.

This prevents layout controls from competing with the intelligence itself.

### What belongs on Today

Today is the immediate action surface, not the place to repeat every intelligence artifact. Prefer:

- the top 1–3 portfolio actions worth attention now;
- compact per-product status/change summaries;
- active work already accepted by the user;
- lifecycle prompts that require a decision;
- links into Product Cockpit for detail.

Do not duplicate full evidence, full signal reasoning, market-gap detail, and complete opportunity inventories here.

## 3. Sidebar product behavior

The sidebar's product list is navigation, not a checklist/decision shortcut.

Clicking a product must open:

`/product/:productId`

The sidebar should use the same explicit product order as Today. Hidden-from-Today products remain available in the sidebar because they are still active products. Retired products do not appear in the active sidebar.

The existing per-product decisions surface remains available as a section/deep link from Product Cockpit rather than being the default product destination.

## 4. Product Cockpit

Each active product gets one all-up operating page.

### Header

- product name
- platform
- canonical URL
- active / lifecycle status
- last successful observation
- last ailhat-observable change
- open signal count
- quick actions: Scan, Edit, Retire

### Intelligence snapshot

At minimum:

- current open checklist/work items
- latest scan findings / scan health
- most recent scan differential
- active opportunities
- lifecycle assessment / retirement evidence
- engagement evidence when connected

### Full evidence home

Product Cockpit is the canonical home for product-specific depth that currently makes Intelligence too dense:

- complete evidence lists;
- full reasoning and thresholds;
- historical signal/differential context;
- detailed scan results;
- product-specific opportunities and market gaps;
- signal history and user feedback;
- decision history;
- lifecycle and engagement evidence.

Intelligence can deep-link directly to the relevant product/signal section instead of rendering all of this inline.

### Decision history

The current per-product decisions experience becomes a section of the cockpit, with a deep link if the full decision editor remains a separate route temporarily.

### Today controls

The cockpit should also expose:

- Show on Today / Hide from Today
- Expanded / Collapsed on Today
- Move earlier / later in Today

This makes workspace composition available from both the workspace and the product itself.

## 5. Intelligence as an editorial brief

Intelligence should stop presenting every valid data product at equal visual weight.

The current stack — portfolio summary, highest-leverage card, attention engine, full signal cards, opportunities, and market gaps — contains useful information but creates excessive simultaneous hierarchy.

### Default Intelligence composition

1. **Lead brief** — one highest-leverage portfolio action with a clear reason and primary action.
2. **What changed** — a compact ranked stream of material changes/signals across products.
3. **Worth watching** — a lighter secondary section for opportunities, drift, and market gaps.
4. **Portfolio pulse** — compact aggregate counts/trends, not four large competing dashboard tiles when those counts are not themselves actionable.

Evidence and computation details should be collapsed by default and live primarily in Product Cockpit.

### Compact signal anatomy

Default card:

- product
- signal title
- one-sentence why-it-matters
- confidence/provenance cue when needed
- primary executable action
- secondary overflow/detail control

Expanded detail may show evidence/reasoning, but should not be the default visual state for every signal.

## 6. Agent-ready action semantics

Intelligence actions must have real downstream outcomes. "Act" or "Fix" cannot merely mutate feedback state or add generic checklist items.

### Fix

Compile an agent-ready work item containing at minimum:

- stable signal/work-item id;
- target product and URL;
- problem statement;
- evidence/provenance;
- desired outcome;
- explicit acceptance criteria;
- constraints / do-not-break boundaries when known;
- relevant context links or product-cockpit anchor;
- recommended skills/capabilities when grounded;
- execution status = prepared, not falsely claimed executed.

Then route the user to Direct with the prepared artifact, with copy/export/handoff options.

### Investigate

Compile a bounded research task containing:

- question to resolve;
- evidence already known;
- unknowns to verify;
- sources/surfaces to inspect;
- stop condition / definition of sufficient evidence;
- expected decision unlocked by the investigation.

This should become a Direct/research work item, not simply another checklist row.

### Snooze

Defer presentation until a defined time or evidence-change condition. No execution artifact is created.

### Dismiss

Suppress the current signal until its underlying evidence materially changes. Preserve the decision as learning feedback.

### Mark incorrect

Record negative model/signal feedback and invalidate the current signal premise. The same inference should not resurface unchanged from identical evidence.

### Checklist use

Checklist items remain useful as human-visible execution state, but they are an output/supporting representation of accepted work — not the terminal outcome of the Intelligence action.

## 7. Persistence model

Workspace composition should persist account-wide, alongside the existing account-scoped portfolio state.

Recommended state shape:

```ts
interface ProductWorkspacePreference {
  visibleOnToday: boolean;
  collapsedOnToday: boolean;
  order: number;
}

workspacePreferences: Record<string, ProductWorkspacePreference>
```

Backward compatibility:

- products without a saved preference default to visible + expanded;
- order falls back to the existing product array order;
- no database schema migration is required because portfolio state is already stored as JSONB.

Prepared agent work should use a stable, explicit work-item representation rather than overloading signal feedback state.

## 8. Lifecycle interactions

### Retire

`active product + workspace preference -> retired archive`

Retirement should preserve the product's last workspace preference in its archive where practical, but reactivation may safely append it to Today rather than restoring a stale position.

### Reactivate

`retired archive -> active product`

Default:

- visible on Today: yes
- collapsed: no
- order: end of current active set

### Delete

Permanent delete remains a destructive secondary action. It should not be the visually primary way to remove a product from Today.

## 9. Acceptance criteria

This pass is complete when:

1. Clicking ALVIRA, LEDGATo, etc. in the sidebar opens an all-up product page, not only decisions.
2. Today no longer depends solely on raw insertion order.
3. A user can reorder products on Today.
4. A user can collapse a product without changing its active intelligence status.
5. A user can hide an active product from Today without retiring it.
6. A user can retire a product and it disappears from active Today/sidebar/planning surfaces while retaining context.
7. A retired product can be reactivated.
8. Workspace composition persists after reload/account hydration.
9. The sidebar and Today share the same user-defined active-product order.
10. The UI clearly distinguishes hidden, collapsed, active, and retired states.
11. Intelligence defaults to a concise editorial brief rather than fully expanded evidence cards.
12. Product Cockpit owns the complete product-specific evidence/reasoning history.
13. Fix produces a prepared agent-ready work item with acceptance criteria and evidence.
14. Investigate produces a bounded research work item with a stop condition.
15. Snooze, Dismiss, and Mark incorrect have distinct persistent semantics.
16. No action claims execution merely because a work artifact was prepared or handed off.

## Product principle

Today is not the portfolio database. It is the user's chosen attention surface.

Intelligence is not the evidence warehouse. It is ailhat's editorial judgment about what matters across the portfolio.

Portfolio is not merely navigation. It is the membership/lifecycle boundary for what ailhat is actively reasoning about.

A product page is not just its decision history. It is the product's operating context inside Portfolio Intelligence.

Direct is the seam where accepted intelligence becomes prepared, governed work for an execution harness.