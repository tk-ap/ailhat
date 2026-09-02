# ailhat `product-state` API Contract

## Endpoint

`GET /api/product-state`

Production URL when deployed:

`https://ailhat.vercel.app/api/product-state`

## Purpose

Expose ailhat's normalized current product state to downstream governed execution and ecosystem systems without requiring those systems to scrape the rendered dashboard.

The product-state contract should represent what ailhat knows, where that knowledge came from, and what remains unverified. It should not imply that the live-site scanner is the only evidence source.

See `docs/PORTFOLIO_EVIDENCE_ARCHITECTURE.md` for the canonical evidence hierarchy and reconciliation rules.

## Contract principles

- ailhat owns Portfolio Intelligence and interpretation of product evidence.
- The API is read-only for downstream consumers.
- Every observation should carry provenance and timestamp information.
- Nullable health/evidence fields mean the relevant source has not supplied a verified value; consumers must not interpret `null` as zero, healthy, inactive, or incomplete.
- Conversation-derived seed context is directional until corroborated by an appropriate evidence source.
- Production evidence is primary for current user-facing reality.
- Repository evidence may explain implementation intent/activity but does not prove a capability is deployed.
- Deployment evidence may prove that a source revision shipped but does not by itself prove the original finding is resolved.
- External execution evidence must be reconciled rather than ignored; absence of ailhat-visible completion is not proof that no work occurred elsewhere.

## Current top-level shape

```json
{
  "ok": true,
  "schema_version": "1.0",
  "product": {},
  "scan": {},
  "health": {},
  "attention": {},
  "work": [],
  "provenance": {}
}
```

## Planned evidence extension

Future versions should add provider-neutral external evidence without breaking the existing contract. Conceptually:

```json
{
  "identity": {
    "public_urls": [],
    "repositories": [],
    "deployments": []
  },
  "external_observations": [],
  "verification": {
    "state": "pending",
    "source_refs": []
  }
}
```

The exact runtime schema should be versioned when implemented. Documentation must not claim these fields are live before the endpoint returns them.

## Integration loop

`ailhat finding → normalized work item → Agent Direct / Agent OS routing → agentic harness or manual execution → external result/evidence → ailhat reconciliation → targeted verification/rescan → updated product state`

A merge, deployment, or external completion event should move ailhat toward **changed / verification pending**, not directly to verified resolution unless the original condition can be authoritatively checked from that same source.

## Evidence reconciliation examples

- GitHub PR merged + no matching production deployment → deployment drift / verification pending.
- GitHub PR merged + Vercel production deployment ready → change shipped / verify original condition.
- Production unchanged + active repository work → active build, not automatic dormancy.
- No ailhat-local completion + external execution evidence → reconcile the outside work before generating a queue-stall conclusion.
- No connected external source → completion/activity remains unknown outside ailhat.

## Runtime TODO

The endpoint currently provides the stable contract and seeded ailhat state. The runtime should evolve toward:

1. authoritative current scan persistence for production evidence
2. optional product-to-repository identity mapping
3. optional product-to-deployment-project identity mapping
4. provider-neutral GitHub/Vercel/execution observations
5. reconciliation state such as external change observed / verification pending
6. source-aware viability, drift, queue, and retirement reasoning
7. provenance-preserving output for downstream Agent Direct / Agent OS consumers
