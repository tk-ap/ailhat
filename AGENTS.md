# Agent Instructions

## Product role

ailhat is **Portfolio Intelligence**. It observes products, classifies signals, identifies what deserves attention, creates outcome-backed initiatives, facilitates understanding and capability-building around those initiatives, and measures whether completed work improved the portfolio.

ailhat should not stop at recommendation. When useful, it should help the user understand the issue, learn the relevant operating pattern, build the capability required to act, and prepare work for governed delegation.

See `docs/FACILITATION.md` for the facilitation product direction.

### Boundaries

- ailhat may propose portable work items backed by portfolio evidence.
- ailhat may teach, guide, review, and help the user prepare work for delegation.
- Agent OS / Workforce owns canonical agents, skills, workforce composition, routing, handoffs, governed task semantics, and host/harness-independent execution policy as shared ecosystem infrastructure; it is not a separate public ailhat offering.
- ALVIRA / MeOS owns Context Intelligence; ALVIRA Bridge is the gated secondary ALVIRA capability that delivers approved context.
- Agent Control owns generic authorization intelligence where integrated.
- LEDGATo participates when work materially intersects governance or enforcement; do not route generic authorization to LEDGATo merely because an action is sensitive.
- cto.new, Codex, Claude Code, Cursor, custom agents, APIs, local workstations, CI, and future Omarchy hosts are replaceable execution harnesses/hosts rather than product ownership layers.
- Do not hard-code one harness or host as the ecosystem execution layer.
- Do not turn ailhat into the canonical workforce registry, skill router, execution runtime, authorization layer, or context source of truth.
- Do not turn Facilitation into a generic LMS. Learning should be contextual, progressive, and attached to live portfolio work.

## Portfolio lifecycle behavior

Active portfolio attention is finite. ailhat should preserve historical product context without treating every product as equally active forever.

- Retirement is reversible lifecycle state, not deletion.
- Retired products should leave active scanning, prioritization, opportunity detection, capacity allocation, and planning surfaces while retaining historical context for later review/reactivation.
- Never auto-retire a product.
- Inactivity alone is not evidence of failure. A retirement recommendation should require corroborating evidence, such as sustained lack of observable product change plus current low/absent engagement evidence.
- If analytics or engagement evidence is unavailable or stale, recommend a lifecycle review or evidence refresh rather than retirement.
- Healthy current engagement is evidence to keep a quiet product active even when development activity is low.

## Facilitation behavior

When a finding or recommendation exposes a capability gap, ailhat should be able to support four modes without changing products:

- **Teach me** — explain the concept using evidence from the live product or portfolio.
- **Guide me** — walk the user through applying the concept to the current initiative.
- **Prepare for delegation** — help define objective, evidence, expected result, and acceptance criteria before dispatch.
- **Review what changed** — compare the completed intervention with the original objective and feed the result back into Portfolio Intelligence.

The desired loop is:

**detect → explain → teach/guide → apply → propose work if appropriate → governed execution → observe result → reflect → adapt future guidance**

Facilitation should develop user judgment and execution capability over time while preserving user agency and the broader ecosystem boundary.

## Agent OS control-plane integration

This repository participates in `tk-ap/agent-os` as the canonical shared workforce/control-plane source.

Before material work:

1. Read Agent OS `BOOTSTRAP.md` and `registry/product-routing.yaml`.
2. Read this repository's `.agent-os/product.yaml` and `.agent-os/integration-surface.yaml`.
3. Read `registry/agents.yaml`, `registry/skills.yaml`, and `policies/HANDOFF_POLICY.md` only as needed for the task.
4. Read `docs/FACILITATION.md` when the task touches recommendations, learning, guidance, capability-building, or execution preparation.
5. Resolve the ailhat product boundary before selecting agents, skills, or an execution harness.

Use Agent OS portable contracts for cross-product handoffs:

- `contracts/work-item.schema.json` — ailhat may create a proposed/accepted cross-boundary work item; the work item does not authorize execution.
- `contracts/context-envelope.schema.json` — request or receive only minimum relevant approved ALVIRA context.
- `contracts/capability-manifest.schema.json` — describe the minimum workforce/tools required when useful.
- `contracts/authorization-request.schema.json` — generic authorization belongs to the authorization-intelligence layer, not ailhat.
- `contracts/outcome-event.schema.json` — return execution/verification evidence so ailhat can measure the original objective.

When accepted work enters Agent OS, the conceptual chain is:

`ailhat signal → evidence-backed work-item → governed task → product/context + policy/authorization → minimum agents/skills → harness/host → execution → verification → outcome-event → ailhat measurement`

A portable work item is not the same as a control-plane task. ailhat owns the portfolio intent and evidence; Agent OS resolves the governed execution instance.

## Completion behavior

For material ailhat work, report:

- **Product result** — what changed or what was learned inside ailhat.
- **Ecosystem implications** — any effect on context, governance, shared workforce, or another product boundary.
- **Cross-product opportunities** — only when the next visible need is supported by evidence.
- **Boundary check** — confirm that ailhat did not silently absorb another product's responsibility or grant itself execution authority.

Cross-market recommendations must follow Agent OS `policies/CROSS_MARKET_POLICY.md`: deliver the current value first, recommend only a next visible need, and never make an adjacent product mandatory to finish the current workflow.
