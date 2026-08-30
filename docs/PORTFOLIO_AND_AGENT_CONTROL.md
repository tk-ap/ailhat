# ailhat Portfolio Scope, Facilitation & Agent Control Handoff

## Purpose

ailhat should not operate as if ailhat is the user's only live business/product. Other live businesses running under the user's cto.new account must remain in portfolio scope and visible enough to avoid neglect.

ailhat should also not stop at detecting or recommending work. When a finding exposes a capability gap, ailhat should be able to explain the issue, facilitate understanding, guide the user through the relevant operating pattern, and prepare the work for governed delegation.

## Ecosystem role

ailhat is the **Portfolio Intelligence layer**:

**Observe → Understand → Detect issues/opportunities → Prioritize → Recommend → Facilitate → Measure outcomes**

Facilitation means helping the user understand what good looks like, learn or apply the relevant capability, and decide whether to act directly or prepare the initiative for delegation. See `docs/FACILITATION_LAYER.md`.

Agent Control is the **execution-capacity layer**:

**Observe capacity → Match work → Reserve window → Route execution → Report completion**

ALVIRA is the broader ecosystem/platform context layer. Its long-term product model is:

**Know You → Connect Everywhere → Work With You → Act For You**

Agent OS / Workforce is a foundational ecosystem infrastructure concept, not a separate public ailhat offering. It provides reusable agents, skills, teams, routing, and execution patterns across products and harnesses.

ailhat should not become Agent Control, the canonical Agent OS / Workforce registry, or the runtime authorization layer. Agent Control should not recreate ailhat's portfolio/market intelligence or facilitation experience. The products should exchange normalized context and work items.

## Current known portfolio

| Product | State | Product context | Readiness |
|---|---|---|---|
| ailhat | Active / private beta / pre-launch | Known | ~65% (directional) |
| LEDGATo | Live | Needs assessment | TBD |
| ALVIRA | Live / strategic ecosystem | Needs assessment | TBD |
| ALVIRA Bridge | Live / strategic ecosystem component | Needs assessment | TBD |
| PolicyGuard | Paused / v1 shown in cto.new portfolio | Needs assessment | TBD |
| WEBSITEHERO | Paused / purchased-business portfolio | Needs assessment | TBD |
| TrendVault | Paused / purchased-business portfolio | Needs assessment | TBD |
| AdScale Pro | Paused / purchased-business portfolio | Needs assessment | TBD |

Do not invent readiness scores, traction, customer claims, or business claims for products that have not been assessed.

## Account / workspace relationship

The connected cto.new portfolio should be represented as:

**Account → workspace/product → repository/site → observations → work items → execution-capacity relationship**

This lets ailhat reason across the portfolio without collapsing distinct products into one project.

## ailhat UI requirement

Add a **Portfolio** / **Other Products** surface to the ailhat dashboard so the user can see:

- all known live/discovered products
- current state
- last scan / last attention
- readiness status
- unresolved blockers
- next recommended action
- attention age / neglect risk
- relationship to Agent Control capacity
- source/provenance for each fact

The current ailhat product remains the primary detail view. The portfolio surface exists to prevent the other businesses from disappearing from the user's operating picture.

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

## Portfolio Intelligence boundary

ailhat owns:

**Observe → Understand → Detect issues/opportunities → Prioritize → Recommend → Facilitate → Measure outcomes**

The Facilitation layer may:

- explain a finding using live portfolio evidence
- teach a relevant concept in context
- guide the user through applying that concept
- review plans, prompts, workflows, handoffs, or workforce designs
- prepare objectives, evidence, expected outcomes, and acceptance criteria for delegation
- track whether the learned capability transfers into later live work

Facilitation must remain attached to real portfolio objectives. Do not turn ailhat into a generic LMS or detached course product.

Agent Control owns:

**Observe capacity → Match work → Reserve window → Route execution → Report completion**

Agent OS / Workforce owns reusable workforce infrastructure such as canonical agents, skills, teams, routing, and handoffs across replaceable agentic harnesses.

ailhat should not reproduce Agent Control's account-capacity dashboard, become the canonical workforce registry, resolve runtime skills, or own runtime authorization. Agent Control and the broader workforce infrastructure should receive ailhat work items and return execution/outcome context.

## Facilitation-to-work handoff

When a recommendation exposes an unfamiliar concept or capability gap, ailhat should support these modes before or alongside delegation:

- **Teach me** — contextual explanation tied to evidence.
- **Guide me** — step-by-step application to the live initiative.
- **Prepare for delegation** — package the objective and evidence into a portable work item.
- **Review what changed** — compare the result with the original objective and update portfolio intelligence.

The desired learning/action loop is:

**detect → explain → teach/guide → apply → dispatch if appropriate → observe result → reflect → adapt future guidance**

## Shared work item

ailhat should be capable of producing a normalized work item containing:

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

Agent Control or the broader Agent OS / Workforce infrastructure can then answer:

> Which available AI capacity should execute this, through which governed harness, and when?

## Ecosystem handoff

The desired loop is:

**ailhat finding → optional facilitation → normalized work item → workforce/capacity match → governed execution → result/evidence → ailhat rescan → outcome review → updated context and future guidance**

This should be implemented as data contracts, not by tightly coupling the UIs.

## First UI pass

On the dashboard, add a compact portfolio strip or command-center layer:

**PORTFOLIO**

ailhat · 65% · P0
LEDGATo · Needs assessment
ALVIRA · Needs assessment
ALVIRA Bridge · Needs assessment
PolicyGuard · Needs assessment
WEBSITEHERO · Needs assessment
TrendVault · Needs assessment
AdScale Pro · Needs assessment

Clicking a product opens its product-specific context.

ailhat remains the default selected product; the others must be visible and monitored.

For findings/recommendations, introduce contextual facilitation entry points such as **Understand this**, **Guide me through it**, **Learn before delegating**, and **Review what changed** rather than creating a disconnected course catalog.

## Provenance rule

Conversation-derived strategy and user-provided portfolio facts are **seed context**, not verified product truth. Persist source and timestamp so later live scans can validate, update, or invalidate them.
