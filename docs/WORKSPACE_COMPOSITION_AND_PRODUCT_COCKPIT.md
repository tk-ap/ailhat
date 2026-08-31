# Workspace composition, Intelligence, Product Cockpit, and operating continuity

## Canonical hierarchy

**Portfolio = membership**  
**Today = attention**  
**Intelligence = judgment**  
**Product Cockpit = depth**  
**Direct = action**

The operating loop is:

**Scan → Review → Prepare work → Execute / hand off → Re-scan → Resolve or reopen**

Portfolio controls membership and lifecycle. Today controls attention and layout. Intelligence edits the portfolio into a ranked brief. Product Cockpit controls one product in depth. Direct turns an accepted intelligence action into an agent-ready work artifact. Re-scan is how ailhat verifies whether the intended product change actually happened.

## Workspace composition

Active products participate in Portfolio Intelligence, scanning, prioritization, opportunity detection, and planning. Retired products leave those active engines but preserve their working context for later review or reactivation.

Today visibility is presentation only:

- expanded
- collapsed
- hidden from Today

A product hidden from Today remains active and intelligent. Retirement is a separate lifecycle action.

Explicit user order should be authoritative for Today and the active-product sidebar. New active products append. Reactivated products return visible, expanded, and at the end of the explicit order unless the user later moves them.

## Product Cockpit

Each active product should open an all-up `/product/:productId` operating page containing:

- product name, platform, canonical URL, and lifecycle state
- last successful observation and latest scan differential
- product-specific signals with evidence/reasoning
- open checklist/work
- opportunities and market gaps scoped to the product
- engagement evidence when connected
- lifecycle/retirement evidence
- decisions and relevant deep links
- actions to scan/re-scan, review Intelligence, prepare agent direction, and retire

The Product Cockpit is where detailed evidence lives. Portfolio should remain the membership/lifecycle index instead of duplicating every product's operational detail.

## Finding lifecycle: active, resolved, regressed

Finding history is evidence and must not disappear merely because the active view becomes quieter.

- **Active** — currently failing evidence. Show prominently.
- **Resolved** — the finding is no longer present in fresh observation. Preserve the history, but default it to a condensed presentation. The user may explicitly hide it from the active view.
- **Regressed** — a previously resolved finding is failing again. Re-surface it automatically as active, even if the older resolved finding had been hidden or condensed.

Hide/condense is **presentation state only**. It must never mutate or delete `ProductScanHistory`.

A destructive delete is a separate explicit action. There is no implicit delete as a consequence of resolution, hiding, condensation, dismissal, or re-scan.

The current branch introduces `src/lib/finding-visibility.ts` as the non-destructive presentation contract. It defaults resolved findings to `condensed`, allows `hidden`, and forces any currently present/regressed issue back to `expanded` so new evidence cannot stay accidentally hidden.

## Intelligence density

Intelligence should read as an editorial brief rather than a wall of equally weighted diagnostics:

1. Lead brief — the highest-leverage portfolio action
2. What changed — compact ranked material changes/signals
3. Worth watching — lighter opportunities/drift/market gaps
4. Portfolio pulse — compact counts/trends

Full evidence and computation details should be collapsed by default and primarily available in Product Cockpit.

## Agent-ready actions

`Fix` and `Investigate` should create inspectable prepared work rather than only write feedback or checklist state.

A Fix artifact should include:

- stable signal/work-item id
- target product and URL
- problem statement
- evidence/provenance
- desired outcome
- explicit acceptance criteria
- constraints/do-not-break when known
- context links/cockpit anchor
- recommended skills/capabilities only when grounded
- execution status = `prepared`

An Investigate artifact should include the question, known evidence, unknowns, sources/surfaces to inspect, a stop condition, and the decision the investigation should unlock.

Prepared work is never the same as executed work. Direct is the seam where accepted intelligence becomes governed work for a replaceable execution harness.

## Feedback semantics

- Snooze — defer until a defined time or evidence-change condition.
- Dismiss — suppress the current inference until the underlying evidence materially changes.
- Mark incorrect — invalidate the current premise; do not regenerate the same inference from identical evidence.
- Acted — does not mean resolved. The signal remains part of the operating loop until outcome evidence confirms resolution or the user explicitly dismisses/handles it.

## Persistence

Workspace composition can remain inside the existing account-scoped JSONB state without a database migration:

```ts
interface ProductWorkspacePreference {
  visibleOnToday: boolean;
  collapsedOnToday: boolean;
  order: number;
}

workspacePreferences: Record<string, ProductWorkspacePreference>
```

Finding visibility is currently presentation-only and persisted separately from scan evidence. It must remain logically separate from ProductScanHistory so a hidden resolved finding can automatically reappear when it regresses.
