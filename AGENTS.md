# Agent Instructions

## Product role

ailhat is the Portfolio Intelligence and management plane. It observes products, classifies signals, identifies what deserves attention, creates outcome-backed initiatives, facilitates understanding and capability-building around those initiatives, and measures whether completed work improved the portfolio.

ailhat should not stop at recommendation. When useful, it should help the user understand the issue, learn the relevant operating pattern, build the capability required to act, and prepare work for governed delegation.

See `docs/FACILITATION.md` for the facilitation product direction.

### Boundaries

- ailhat may propose and dispatch work items.
- ailhat may teach, guide, review, and help the user prepare work for delegation.
- Agent OS / Workforce owns canonical agents, skills, teams, routing, and handoffs as ecosystem infrastructure; it is not a separate public ailhat offering.
- ALVIRA owns Context Intelligence; Bridge distributes approved context.
- LEDGATo owns operational authorization and evidence.
- cto.new, Codex, Claude Code, Cursor, custom agents, APIs, and automations are replaceable agentic harnesses.
- Do not hard-code one harness as the ecosystem execution layer.
- Do not turn ailhat into the canonical workforce registry, skill router, runtime policy engine, or authorization layer.
- Do not turn Facilitation into a generic LMS. Learning should be contextual, progressive, and attached to live portfolio work.

## Portfolio lifecycle behavior

Active portfolio attention is finite. ailhat should preserve historical product context without treating every product as equally active forever.

- Retirement is reversible lifecycle state, not deletion.
- Retired products should leave active scanning, prioritization, opportunity detection, capacity allocation, and planning surfaces while retaining their historical context for later review/reactivation.
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

**detect → explain → teach/guide → apply → dispatch if appropriate → observe result → reflect → adapt future guidance**

Facilitation should develop user judgment and execution capability over time while preserving user agency and the broader ecosystem boundary.

## Shared Agent OS and ecosystem awareness

Before material work, read `tk-ap/agent-os` `BOOTSTRAP.md`, `ecosystem/ECOSYSTEM.md`, `ecosystem/products.yaml`, `products/ailhat.md`, this repository's `.agent-os/` manifests, and `docs/FACILITATION.md` when the task touches recommendations, learning, guidance, workforce design, or execution preparation.

Use shared contracts for cross-product handoffs. An approved actionable finding should produce a portable work item for Agent OS. Completed execution should return an outcome event that ailhat can measure against the original objective.

At completion report Product result, Ecosystem implications, Cross-product opportunities, and Boundary check. Cross-product promotion must follow Agent OS `ecosystem/cross-market-policy.md`.
