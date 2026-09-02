# Founding Beta and commercial rails

Founding Beta is the first controlled customer-access layer for ailhat. It is intentionally separate from pricing and billing so early product learning is not misrepresented as commercial traction.

## Access model

- Normal public signup remains closed after the first platform-owner account.
- New customer accounts are created only through a valid Founding Beta invite.
- Invite issuance is disabled unless `AILHAT_BETA_INVITES_ENABLED=true` is set in the deployment environment.
- Default invite lifetime is 7 days.
- Default beta-access lifetime is 45 days.
- Invite and access durations may be bounded per invite.
- The first account remains the platform owner unless `AILHAT_OWNER_EMAIL` explicitly identifies the owner account.
- Owner access is independent of Founding Beta entitlement.
- Customer product access exists only while Founding Beta entitlement is active, unexpired, and unrevoked.
- Expiry or revocation removes private product access without deleting the user's login identity.

## Tenant-safety dependency

Founding Beta must only run on top of the tenant-isolation boundary introduced before this rollout:

- portfolio state is keyed by authenticated user;
- Agent Direct models only the signed-in account's products;
- scan/availability observations are tenant-scoped;
- repository/deployment evidence is tenant-scoped;
- RADAR signals are tenant-scoped;
- browser continuity caches are cleared across tenant changes;
- anonymous Direct uses synthetic demo data only.

A beta rollout must not be enabled if any authenticated surface can read founder seed data or another account's evidence.

## Commercial separation

`account_plans` is a stable commercial abstraction, but Founding Beta does not imply payment.

- beta entitlement and plan state are stored separately;
- beta users remain on the neutral/free commercial plan until an actual paid plan exists;
- no revenue, conversion, willingness-to-pay, or pricing success should be inferred from beta membership;
- pricing decisions should follow observed usage and customer feedback.

Useful pricing-learning signals include portfolio size, observation cadence, evidence depth, intelligence actions taken, Direct handoffs, verification frequency, connected sources, and eventual team use.

## Feedback boundary

Founding Beta feedback stores only:

- category;
- free-text message;
- route context.

Portfolio contents and evidence are never attached automatically.

## Rollout sequence

1. Deploy with `AILHAT_BETA_INVITES_ENABLED` unset/false.
2. Smoke-test the owner account and all private product surfaces.
3. Run a disposable second-account isolation test.
4. Confirm expiry/revocation blocks private product access while login identity remains valid.
5. Enable `AILHAT_BETA_INVITES_ENABLED=true` only after the isolation test passes.
6. Invite a deliberately small cohort and observe the complete activation journey.

## First-user activation milestone

The beta is useful only if a new user can complete this loop without founder intervention:

`invite → account → add first product → establish production URL → first observation/scan → understand what deserves attention → choose a decision → prepare/direct work → verify the change`

This journey is the next product-validation lane after the beta infrastructure is merged.
