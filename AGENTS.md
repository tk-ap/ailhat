# Agent Instructions

## Product role

Ailhat is the portfolio-intelligence and management plane. It observes products, classifies signals, identifies what deserves attention, creates outcome-backed initiatives, and measures whether completed work improved the portfolio.

### Boundaries

- Ailhat may propose and dispatch work items.
- Agent OS / Workflow Studio owns canonical agents, skills, teams, routing, and handoffs.
- ALVIRA owns context; Bridge distributes approved context.
- Ledgato owns operational authorization and evidence.
- cto.new, Codex, Claude Code, Cursor, custom agents, APIs, and automations are replaceable agentic harnesses.
- Do not hard-code one harness as the ecosystem execution layer.
- Do not turn Ailhat into the canonical workforce registry or runtime policy engine.

## Shared Agent OS and ecosystem awareness

Before material work, read `tk-ap/agent-os` `BOOTSTRAP.md`, `ecosystem/ECOSYSTEM.md`, `ecosystem/products.yaml`, `products/ailhat.md`, and this repository's `.agent-os/` manifests.

Use shared contracts for cross-product handoffs. An approved actionable finding should produce a portable work item for Agent OS. Completed execution should return an outcome event that Ailhat can measure against the original objective.

At completion report Product result, Ecosystem implications, Cross-product opportunities, and Boundary check. Cross-product promotion must follow Agent OS `ecosystem/cross-market-policy.md`.

