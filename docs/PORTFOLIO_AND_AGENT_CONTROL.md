# Ailhat Portfolio Scope & Agent Control Handoff

## Purpose

Ailhat should not operate as if Ailhat is the user's only live business/product. Other live businesses running under the user's `tk.ashwood@outlook.com` cto.new account must remain in portfolio scope and visible enough to avoid neglect.

## Current known portfolio

| Product | State | Product context | Readiness |
|---|---|---|---|
| Ailhat | Active / private beta / pre-launch | Known | ~65% (directional) |
| Ledgato | Live | Needs assessment | TBD |
| ALVIRA | Live / strategic ecosystem | Needs assessment | TBD |
| ALVIRA Bridge | Live / strategic ecosystem component | Needs assessment | TBD |
| Hoopdash | Live project detected in hosting portfolio | Needs confirmation + assessment | TBD |

Do not invent readiness scores or business claims for products that have not been assessed.

## Ailhat UI requirement

Add a **Portfolio** / **Other Products** surface to the Ailhat dashboard so the user can see:

- all known live products
- current state
- last scan / last attention
- readiness status
- unresolved blockers
- next recommended action
- attention age / neglect risk
- relationship to Agent Control capacity

The current Ailhat product remains the primary detail view. The portfolio surface exists to prevent the other businesses from disappearing from the user's operating picture.

## Neglect detection

For every live product track:

- last meaningful work date
- last live scan date
- days since attention
- current status
- unresolved blockers
- next review date

Flag `NEEDS ATTENTION` when a live product has gone more than 7 days without meaningful attention, when its scan is stale, or when a significant blocker remains unresolved.

Possible states:

`ACTIVE` · `NEEDS ATTENTION` · `STALE` · `BLOCKED` · `HEALTHY` · `NEEDS ASSESSMENT`

## Product intelligence boundary

Ailhat owns:

**Observe → Understand → Detect issues/opportunities → Prioritize → Recommend**

Agent Control owns:

**Observe capacity → Match work → Reserve window → Route execution → Report completion**

Ailhat should not reproduce Agent Control's account-capacity dashboard. Agent Control should receive Ailhat work items and add execution capacity context.

## Shared work item

Ailhat should be capable of producing a normalized work item containing:

- product/workspace
- title
- problem/opportunity
- evidence
- priority
- estimated effort
- suggested execution mode
- expected product impact
- source
- created_at

Agent Control can then answer:

> Which available AI capacity should execute this, and when?

## First UI pass

On the dashboard, add a compact portfolio strip or command-center layer:

**PORTFOLIO**

Ailhat · 65% · P0
Ledgato · Needs assessment
ALVIRA · Needs assessment
ALVIRA Bridge · Needs assessment
Hoopdash · Needs assessment

Clicking a product opens its product-specific context.

Ailhat remains the default selected product; the others must be visible and monitored.
