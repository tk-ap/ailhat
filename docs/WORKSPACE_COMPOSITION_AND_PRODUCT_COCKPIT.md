# ailhat workspace composition + product cockpit

## Why this pass exists

The current shell still reflects the original owner-era information architecture:

- sidebar product links go directly to a narrow per-product decisions surface;
- Today renders every active product in raw storage order;
- lifecycle retirement exists, but Today has no explicit composition controls;
- there is no single all-up product surface that gathers the product's current intelligence, scan history, work, decisions, opportunities, and lifecycle state.

This pass reconciles those surfaces around one model:

> Portfolio controls membership and lifecycle. Today controls attention and layout. Product Cockpit controls one product in depth.

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

### Decision history

The current per-product decisions experience becomes a section of the cockpit, with a deep link if the full decision editor remains a separate route temporarily.

### Today controls

The cockpit should also expose:

- Show on Today / Hide from Today
- Expanded / Collapsed on Today
- Move earlier / later in Today

This makes workspace composition available from both the workspace and the product itself.

## 5. Persistence model

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

## 6. Lifecycle interactions

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

## 7. Acceptance criteria

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

## Product principle

Today is not the portfolio database. It is the user's chosen attention surface.

Portfolio is not merely navigation. It is the membership/lifecycle boundary for what ailhat is actively reasoning about.

A product page is not just its decision history. It is the product's operating context inside Portfolio Intelligence.
