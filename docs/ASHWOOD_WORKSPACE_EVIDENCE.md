# ailhat → ASHWOOD `/workspace` Evidence Contract

## Boundary

ailhat remains authoritative for **Portfolio Intelligence**. ASHWOOD `/workspace` remains authoritative for **human-level goal synthesis**.

ailhat should report what it knows about products, portfolio attention, launch/readiness state, blockers, and work. ASHWOOD decides whether those facts advance or conflict with the user's larger Saturn Return goals.

## Runtime source

`GET /api/product-state`

Schema `1.1` adds `workspace_evidence` without removing the existing product-state fields.

```json
{
  "workspace_evidence": {
    "contract_version": "1.0",
    "authoritative_domain": "portfolio_intelligence",
    "consumer": "ashwood_workspace",
    "evidence_state": "seed_until_scan_timestamped",
    "items": []
  }
}
```

Each evidence item should preserve:

- stable `id`
- `kind`
- `product_id`
- human-readable `title`
- portfolio `status` / `priority`
- `occurred_at` when authoritative timing exists
- numeric `confidence`
- `source` and `source_ref`
- optional `suggested_goal_ids`
- optional `next_action`

## Trust rule

`occurred_at: null` means the item is not timestamped live evidence. ASHWOOD must not turn a seed item into a confirmed accomplishment or recent event merely because the endpoint returned it.

The current contract deliberately marks seed-derived intelligence with lower confidence until ailhat's live scan persistence supplies authoritative timestamps and findings.

## Integration rule

The contract is read-only. ASHWOOD must not write life-goal classifications back into ailhat. A user correction inside `/workspace` changes ASHWOOD's interpretation of the evidence, not ailhat's product truth.

Desired flow:

**ailhat product evidence → workspace evidence contract → ASHWOOD goal mapping → human correction if needed → progress / neglect / contradiction synthesis**
