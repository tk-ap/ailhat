# Agent Instructions

## Product role

ailhat is **Portfolio Intelligence**. It observes products, classifies signals, identifies what deserves attention, creates outcome-backed initiatives, facilitates understanding and capability-building around those initiatives, and measures whether completed work improved the portfolio.

ailhat should not stop at recommendation. When useful, it should help the user understand the issue, learn the relevant operating pattern, build the capability required to act, and prepare evidence-backed work for governed delegation.

See `docs/FACILITATION.md` for the facilitation product direction.
See `docs/PORTFOLIO_EVIDENCE_ARCHITECTURE.md` for the canonical evidence hierarchy, repository-context role, external observations, and reconciliation rules.

### Boundaries

- ailhat may propose portable work items backed by portfolio evidence; proposing work does not authorize execution.
- Agent Direct is ailhat's user-facing handoff surface into governed action. It is not the canonical authorization engine, workforce registry, or execution runtime.
- Agent OS / Workforce owns canonical agents, skills, workforce composition, routing, handoffs, governed task semantics, and host/harness-independent execution policy as shared ecosystem infrastructure; it is not a separate public ailhat offering.
- ALVIRA / MeOS owns Context Intelligence; ALVIRA Bridge is the gated secondary ALVIRA capability for approved context delivery.
- Agent Control is the authorization-intelligence layer in the Agent OS control plane where integrated; do not reintroduce it as a separate public ailhat offering.
- LEDGATo participates only when work materially intersects its defined governance or enforcement scope; do not route generic authorization or portfolio work there by default.
- cto.new, Codex, Claude Code, Cursor, custom agents, APIs, local workstations, CI, and future hosts are replaceable execution harnesses/hosts rather than product ownership layers.
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

## Evidence behavior

Portfolio Intelligence should reason across sources without pretending any one source is complete.

Canonical source order:

1. production / live product — current user-facing reality
2. linked repository — implementation intent and activity
3. deployment provider — what source revision actually shipped
4. ailhat history — longitudinal observation, decision, work, and verification state
5. external market / engagement signals — viability and demand evidence

Rules:

- Production is primary for what users can experience now.
- Repository context is optional but recommended secondary evidence. Code or documentation in a repo does not prove a capability is live.
- A merged PR is evidence that work occurred. A successful deployment is evidence that a revision shipped. Neither should be silently promoted into verified resolution when the original condition can still be checked in production.
- Absence of ailhat-local completion is not proof that no work happened through GitHub, Vercel, Agent Direct, Agent OS, another harness/environment, or manually.
- If an external source is not connected or cannot be read, represent the outside state as unknown rather than zero/inactive/incomplete.
- Conflicts between production, repository, deployment, execution, history, and market evidence are themselves intelligence. Reconcile them; do not silently let one source overwrite another.
- Product viability and retirement conclusions require evidence appropriate to viability. Repository activity alone is not demand, and a quiet repository alone is not failure.

Useful reconciliation concepts include deployment drift, active build, external change / verification pending, production regression, spec/implementation drift, and corroborated dormancy review.

## Facilitation behavior

When a finding or recommendation exposes a capability gap, ailhat should be able to support four modes without changing products:

- **Teach me** — explain the concept using evidence from the live product or portfolio.
- **Guide me** — walk the user through applying the concept to the current initiative.
- **Prepare for delegation** — help define objective, evidence, expected result, and acceptance criteria before handoff.
- **Review what changed** — compare the completed intervention with the original objective and feed the result back into Portfolio Intelligence.

The desired loop is:

**detect → explain → teach/guide → apply → propose work if appropriate → governed execution → observe result → verify → reflect → adapt future guidance**

Facilitation should develop user judgment and execution capability over time while preserving user agency and the broader ecosystem boundary.

## Agent OS control-plane integration

This repository participates in `tk-ap/agent-os` as the canonical shared workforce/control-plane source.

Before material work:

1. Read Agent OS `BOOTSTRAP.md` and `registry/product-routing.yaml`.
2. Read this repository's `.agent-os/product.yaml` and `.agent-os/integration-surface.yaml`.
3. Load `policies/AUTONOMY_POLICY.md` and `policies/HANDOFF_POLICY.md` before execution when relevant; load `policies/CROSS_MARKET_POLICY.md` for cross-product recommendations.
4. Read `registry/agents.yaml`, `registry/skills.yaml`, and the Skill Resolver only as needed for the task.
5. Read `docs/FACILITATION.md` when the task touches recommendations, learning, guidance, capability-building, or execution preparation.
6. When the task touches product viability, scanning, external completion, repositories, deployments, drift, lifecycle state, retirement, verification, or provenance, also read `docs/PORTFOLIO_EVIDENCE_ARCHITECTURE.md` and `docs/SHARED_CONTEXT_CONTRACT.md`.
7. Resolve the ailhat product boundary before selecting agents, skills, an execution harness, or a host.

Use Agent OS portable contracts for cross-product handoffs:

- `contracts/work-item.schema.json` — ailhat may create a proposed/accepted cross-boundary work item; the work item does not authorize execution.
- `contracts/context-envelope.schema.json` — request or receive only minimum relevant approved ALVIRA context.
- `contracts/capability-manifest.schema.json` — describe the minimum workforce/tools required when material.
- `contracts/authorization-request.schema.json` — authorization intelligence remains outside ailhat and must be explicit when required.
- `contracts/outcome-event.schema.json` — return execution/verification evidence so ailhat can measure the original objective.

When accepted work enters Agent OS, the conceptual chain is:

`ailhat signal → evidence-backed work-item → governed task → product/context + policy/authorization → minimum agents/skills → harness/host → execution → verification → outcome-event → ailhat measurement`

A portable work item is not the same as a control-plane task. ailhat owns the portfolio intent and evidence; Agent OS resolves the governed execution instance.

## Completion behavior

For material ailhat work, report:

- **Product result** — what changed or what was learned inside ailhat.
- **Ecosystem implications** — any effect on context, governance, shared workforce, evidence sources, or another product boundary.
- **Cross-product opportunities** — only when the next visible need is supported by evidence.
- **Boundary check** — confirm that ailhat did not silently absorb another product's responsibility or grant itself execution authority.

Cross-market recommendations must follow Agent OS `policies/CROSS_MARKET_POLICY.md`: deliver the current value first, recommend only a next visible need, and never make an adjacent product mandatory to finish the current workflow.
