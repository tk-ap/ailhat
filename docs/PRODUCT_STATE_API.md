# Ailhat `product-state` API Contract

## Endpoint

`GET /api/product-state`

Production URL when deployed:

`https://ailhat.vercel.app/api/product-state`

## Purpose

Expose Ailhat's normalized current product state to downstream systems such as Agent Control without requiring those systems to scrape the rendered dashboard.

## Contract principles

- Ailhat owns product intelligence and live-scan interpretation.
- The API is read-only for downstream consumers.
- Every observation should carry provenance and timestamp information.
- Nullable health fields mean the runtime source has not yet supplied a verified value; consumers must not interpret `null` as zero or healthy.
- Conversation-derived seed context is directional until validated by the owner dashboard's live scan.

## Top-level shape

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

## Integration loop

`Ailhat finding → normalized work item → Agent Control capacity match → execution → result/evidence → Ailhat rescan → updated product state`

## Runtime TODO

The endpoint currently provides the stable contract and seeded Ailhat state. The owner-dashboard live-scan persistence layer should populate `scan.observed_at` and the nullable `health.*` fields from the authoritative current scan so Agent Control receives verified live state rather than duplicating or scraping the UI.
