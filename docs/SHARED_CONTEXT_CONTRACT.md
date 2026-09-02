# Shared Context Contract

Status: architectural contract, v1.

The ecosystem uses one transferable `ContextEnvelope` across ALVIRA and ailhat. The products interpret context differently, but they do not redefine its meaning in transit.

For ailhat's multi-source product evidence hierarchy, repository/deployment identity model, and reconciliation rules, see `docs/PORTFOLIO_EVIDENCE_ARCHITECTURE.md`.

## Product responsibilities

- **ALVIRA**: personal/context intelligence — helps AI understand the person, their goals, preferences, history, constraints, identity and working context.
- **ailhat**: portfolio intelligence — helps AI understand what the person is building, including product priorities, business goals, customer evidence, market signals, decisions and launch constraints.
- **LEDGATo**: authorization intelligence — governs what agents may read, use, mutate or share.

Shared context is infrastructure, not a separate public product.

## Context Envelope

Canonical runtime schema: `shared-context/v1` in `src/lib/context-envelope.ts`.

Universal context types:

`fact · preference · goal · constraint · focus · evidence · assertion · rationale`

Universal subject types:

`person · product · portfolio · business · goal · decision · domain`

Every envelope preserves:

- stable context id and timestamps
- source product and optional source reference
- subject and context type
- original content
- provenance
- verification status
- optional confidence
- sensitivity and sharing scope
- validity window
- related entities
- domain-specific extensions

## Non-negotiable truth rule

**Transfer preserves epistemic status.**

A receiving product MUST NOT silently promote:

- `user-supplied` → `verified`
- `assertion` → `fact`
- stale evidence → current evidence
- local/private context → shared context

Example: “auth is fixed” supplied by a founder can guide conversation, but it remains an assertion until observed or verified evidence supports it.

## Portfolio evidence provenance

ailhat may combine context from production, repositories, deployment systems, execution environments, its own longitudinal history, and external market/engagement sources.

These sources are complementary rather than interchangeable:

- production describes current user-facing reality
- repository context describes implementation intent and activity
- deployment evidence connects source revisions to releases
- execution evidence describes work attempted or completed outside ailhat
- ailhat history describes persistence, regression, decisions, and verification over time
- market/engagement evidence informs product viability and demand

A repository statement that a feature exists MUST NOT be promoted into “live in production” without deployment/production evidence. A missing integration MUST be represented as unknown rather than zero. A lack of ailhat-visible completion MUST NOT be promoted into “no work completed.”

When context crosses product boundaries, preserve the provider/source reference, timestamp, confidence, verification state, and—where applicable—the scope for which that source is authoritative.

## Bidirectional exchange

ALVIRA → ailhat examples:

- current goal
- working preference
- time/budget constraint
- relevant personal context explicitly shared for portfolio reasoning

ailhat → ALVIRA examples:

- current product/business focus
- portfolio goal
- decision rationale
- founder assertion or observed portfolio evidence

Products must preserve extensions they do not understand so round-tripping is lossless.

## UX primitive: Add Context

“Add Context” is an ecosystem-wide interaction pattern, not one product’s exclusive feature.

ALVIRA Add Context teaches the system more about the person.
ailhat Add Context teaches the system more about the portfolio decision environment.

Both emit the same `ContextEnvelope` format.

Future controls should expose:

- Use in this product
- Share with ALVIRA / ailhat
- Keep local
- Stop sharing
- source + verification status

## Operating throughline

`Context → Intelligence → Governed Action → New Evidence → Context`

Or, by product responsibility:

`ALVIRA context intelligence → ailhat portfolio intelligence → LEDGATo authorization → execution → fresh evidence → updated shared context`

Within ailhat, external product evidence follows:

`observe source → preserve provenance → reconcile sources → decide → verify → update portfolio state`

## Implementation sequence

1. Treat `shared-context/v1` as the canonical interchange shape.
2. Add ailhat Add Context using this envelope rather than a new local schema.
3. Map ALVIRA context exports/imports onto the same envelope.
4. Add explicit sharing controls and provenance-preserving round-trip tests.
5. Add product evidence identity mapping and provider-neutral external observations per `PORTFOLIO_EVIDENCE_ARCHITECTURE.md`.
6. Only then add automated cross-product and external-source synchronization.
