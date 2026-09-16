# Agent Control — Auto Sync UX

## Product intent
The UI should make Agent Control feel like a source of truth, not a form that the owner manually maintains.

### Primary promise
**Connect once. Agent Control keeps watch.**

## Dashboard behavior
- Lead with `CAPACITY NOW`, not source setup.
- Show `Live`, `Recently seen`, and `Stale` states prominently.
- Every capacity figure must show observation freshness.
- Prefer derived decisions over raw telemetry: `Best window`, `Use now`, `Wait`, `Reserve`.
- Surface only actionable alerts; do not create dashboard noise.

## Sources behavior
- First visit: explain browser companion and why it is needed.
- After installation, automatically detect supported cto.new pages.
- Infer provider, account email, plan, workspace, and visible capacity.
- Ask for confirmation only when an inferred identity/workspace is ambiguous.
- Persist confirmed account/workspace mappings.
- Do not ask the user to re-enter information already visible on the source page.

## Sync states
- LIVE: observation < 5 minutes old.
- RECENT: observation 5–60 minutes old.
- STALE: observation > 60 minutes old.
- OFFLINE: no observation for 24 hours or connector unavailable.
- Never label stale data as realtime.

## Capacity intelligence
Normalize each observation into:
- provider
- account
- login provider
- plan
- workspace(s)
- current usage
- current available capacity
- rolling-window semantics
- capacity return events: amount + available_at
- observed_at
- source method

Derived UI:
- `Available now`
- `Next useful window`
- `Largest upcoming window`
- `Full recovery`
- `Recommended account`

## Recommendation examples
- `USE NOW` when meaningful capacity is available and a queued task matches the source.
- `WAIT` when a materially larger capacity window is imminent.
- `RESERVE` when only a small window is available and a higher-priority task is likely.
- `HEALTHY` when all important sources are current and no action is needed.

## Browser companion
- Observe supported authenticated tabs automatically after installation.
- Read visible page content only.
- Detect account/provider/workspace without manual re-entry where possible.
- Send observations on meaningful changes plus periodic heartbeat.
- Never collect passwords, cookies, session tokens, private storage, or network traffic.
- Manual `Sync now` remains as a diagnostic fallback, not the primary workflow.

## Failure handling
If extraction fails:
- keep last known value;
- clearly show `stale`;
- record the reason when available;
- offer `Refresh source` / `Open source` rather than forcing manual data entry.

## UI principle
Do not expose implementation concepts such as "scrape" or "parser" to normal users. Use language like `Live source`, `Last observed`, `Watching`, `Needs attention`, and `Reconnect`.
