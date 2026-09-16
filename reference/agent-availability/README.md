# Agent Availability / Agent Control — archived reference

Status: **reference only — not active ailhat runtime code**

This directory preserves the small amount of uniquely useful implementation prior art from the retired `tk-ap/agent-availability` repository so that standalone repository can be deleted without losing work that may inform ailhat sensors and portfolio intelligence.

Source provenance:

- original repository: `tk-ap/agent-availability`
- original branch: `main`
- original commit: `f203799e56a490f1316fce555eb9daca9329b623`
- preserved into ailhat: 2026-09-15

## Why this belongs in ailhat

The old repository changed identity over time from a personal agent-capacity tracker into an "Agent Control" portfolio command center. That product identity is no longer canonical.

Current ecosystem boundaries supersede it:

- **ailhat** owns Portfolio Intelligence: evidence reconciliation, opportunity/risk/drift/work detection, prioritization, recommendations, verification, and portfolio-facing capacity observations.
- **Agent Direct** is ailhat's governed action handoff surface.
- **Agent OS / Workforce** owns task-first execution, harness routing, execution policy, verification, and returned evidence.
- **Agent Control**, where the name is still used, is an internal authorization-intelligence layer in the Agent OS control plane — not this retired dashboard and not a separate public product.
- **LEDGATo** remains conditional for enforcement/governance work.

See `docs/PORTFOLIO_AND_AGENT_CONTROL.md` for the current boundary.

## Preserved artifacts

### `discovery/discover.js`

A small evidence-first experiment that:

- crawls same-origin public pages;
- extracts visible/document metadata signals;
- infers a tentative agent/product profile with confidence and provenance;
- leaves unsupported facts as unknown rather than forcing manual entry.

This is prior art for ailhat observation/sensor design, not a production crawler. Its keyword heuristics are simplistic and must not be treated as authoritative inference.

### `browser-live-sync/`

A Manifest V3 browser-sensor experiment that reads **visible page text only** from supported AI work surfaces and emits a normalized availability observation. The privacy boundary is worth preserving:

- no passwords;
- no cookies;
- no session tokens;
- no local/private storage reads from the source page;
- no network interception;
- fail quiet when a value cannot be recognized instead of inventing one.

The copied extension still contains historical names/URLs and is not install-ready as an ailhat feature. Port the idea into owned ailhat code before use.

### `AUTO_SYNC_UX.md`

The useful UX contract around freshness, stale states, observation provenance, and derived decisions such as `USE NOW`, `WAIT`, and `RESERVE`.

## Already superseded — intentionally not copied

The following old repository material is deliberately not preserved as source:

- `index.html` static dashboard and localStorage-first product shell;
- `assessment.js` manual questionnaire and simplistic readiness scoring;
- `control.js` monolithic prototype UI;
- `PRODUCT_READINESS.md` and `product-readiness.json` hard-coded product/readiness estimates;
- `api/sync.js` in-memory serverless state store and hard-coded portfolio table;
- the older duplicate `extension/` browser companion;
- old ecosystem/cto.new account notes already represented by newer architecture docs;
- stale branding that describes Agent Control as a standalone public product.

`db/migrations/002_availability_observations.sql` in ailhat already provides a durable availability-observation store and supersedes the old ephemeral `/api/sync` persistence model.

## Reuse rules

1. Treat everything here as **prior art**, not a dependency.
2. Do not import this directory into ailhat runtime or deployment paths.
3. Port useful concepts into owned code with current evidence, freshness, privacy, and capacity contracts.
4. Do not revive the retired standalone Agent Control product boundary from this historical source.
5. Do not reuse fixed readiness percentages, hard-coded portfolio truth, or heuristic confidence as verified facts.
