# Ailhat Portfolio Scope & Agent Control Handoff

## Purpose

Ailhat should not operate as if Ailhat is the user's only live business/product. Other live businesses running under the user's cto.new account must remain in portfolio scope and visible enough to avoid neglect.

## Ecosystem role

Ailhat is the **product intelligence layer**:

**Observe → Understand → Detect issues/opportunities → Prioritize → Recommend**

Agent Control is the **execution-capacity layer**:

**Observe capacity → Match work → Reserve window → Route execution → Report completion**

ALVIRA is the broader ecosystem/platform context layer. Its long-term product model is:

**Know You → Connect Everywhere → Work With You → Act For You**

Ailhat should not become Agent Control, and Agent Control should not recreate Ailhat's product/market intelligence. The products should exchange normalized context and work items.

## Current known portfolio

| Product | State | Product context | Readiness |
|---|---|---|---|
| Ailhat | Active / private beta / pre-launch | Known | ~65% (directional) |
| Ledgato | Live | Needs assessment | TBD |
| ALVIRA | Live / strategic ecosystem | Needs assessment | TBD |
| ALVIRA Bridge | Live / strategic ecosystem component | Needs assessment | TBD |
| Hoopdash | Live project detected in hosting portfolio | Needs confirmation + assessment | TBD |
| PolicyGuard | Paused / v1 shown in cto.new portfolio | Needs assessment | TBD |
| WEBSITEHERO | Paused / purchased-business portfolio | Needs assessment | TBD |
| TrendVault | Paused / purchased-business portfolio | Needs assessment | TBD |
| AdScale Pro | Paused / purchased-business portfolio | Needs assessment | TBD |

Do not invent readiness scores, traction, customer claims, or business claims for products that have not been assessed.

## Account / workspace relationship

The connected cto.new portfolio should be represented as:

**Account → workspace/product → repository/site → observations → work items → execution-capacity relationship**

This lets Ailhat reason across the portfolio without collapsing distinct products into one project.

## Ailhat UI requirement

Add a **Portfolio** / **Other Products** surface to the Ailhat dashboard so the user can see:

- all known live/discovered products
- current state
- last scan / last attention
- readiness status
- unresolved blockers
- next recommended action
- attention age / neglect risk
- relationship to Agent Control capacity
- source/provenance for each fact

The current Ailhat product remains the primary detail view. The portfolio surface exists to prevent the other businesses from disappearing from the user's operating picture.

## Portfolio context fields

Every product/workspace record should support at minimum:

- `name`
- `slug`
- `state`
- `source`
- `account_ref`
- `platform`
- `url`
- `repo_ref`
- `description`
- `customer_target`
- `business_model`
- `launch_stage`
- `readiness_score`
- `readiness_confidence`
- `distance_to_first_paid_client`
- `last_meaningful_work_at`
- `last_scan_at`
- `last_attention_at`
- `next_review_at`
- `attention_status`
- `neglect_risk`
- `open_blocker_count`
- `top_next_action`
- `context_source`
- `context_updated_at`

Use nullable fields when evidence is not yet available.

## Neglect detection

For every live/discovered product track:

- last meaningful work date
- last live scan date
- days since attention
- current status
- unresolved blockers
- next review date

Flag `NEEDS ATTENTION` when a live product has gone more than 7 days without meaningful attention, when its scan is stale, or when a significant blocker remains unresolved.

Possible states:

`ACTIVE` · `NEEDS ATTENTION` · `STALE` · `BLOCKED` · `HEALTHY` · `NEEDS ASSESSMENT` · `PAUSED`

Important: paused products must remain visible. The system should recommend **revive, schedule review, or archive** rather than silently dropping them.

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
- context snapshot reference

Agent Control can then answer:

> Which available AI capacity should execute this, and when?

## Ecosystem handoff

The desired loop is:

**Ailhat finding → normalized work item → Agent Control capacity match → execution → result/evidence → Ailhat rescan → updated context**

This should be implemented as data contracts, not by tightly coupling the UIs.

## First UI pass

On the dashboard, add a compact portfolio strip or command-center layer:

**PORTFOLIO**

Ailhat · 65% · P0
Ledgato · Needs assessment
ALVIRA · Needs assessment
ALVIRA Bridge · Needs assessment
Hoopdash · Needs assessment
PolicyGuard · Needs assessment
WEBSITEHERO · Needs assessment
TrendVault · Needs assessment
AdScale Pro · Needs assessment

Clicking a product opens its product-specific context.

Ailhat remains the default selected product; the others must be visible and monitored.

## Provenance rule

Conversation-derived strategy and user-provided portfolio facts are **seed context**, not verified product truth. Persist source and timestamp so later live scans can validate, update, or invalidate them.
