# Launch Readiness implementation contract

Launch Readiness must summarize observed evidence without converting missing evidence into a failure or inventing a percentage from account age, product age, activity, or founder intuition.

## Current assessment inputs

The first implemented assessment uses account-scoped evidence already available to ailhat:

- production-site reachability from the latest persisted scan
- critical/high technical scan failures
- medium-severity public launch-quality findings
- unresolved high-severity work recorded for that product
- whether the recorded production URL establishes an HTTPS boundary

These observed dimensions account for 75% of the current weighted assessment model when all are available.

The following launch dimensions remain explicit `unknown` until ailhat has an authoritative observation for them:

- end-to-end primary conversion path
- authenticated account flow
- mobile/responsive browser behavior
- analytics/measurement presence
- executed first-user or agent journey

## Scoring rule

A readiness percentage is emitted only when at least 60% of weighted launch evidence is observed and a production scan exists.

The percentage is calculated over **observed dimensions only**:

`verified observed weight / total observed weight`

Unknown dimensions are excluded from both the numerator and denominator. They remain visible as evidence-coverage debt. This prevents an unavailable integration or unexecuted test from being silently treated as either success or failure.

Readiness is therefore always presented with evidence coverage and confidence. A product can show a high readiness percentage with incomplete coverage; that means the observed surfaces are healthy, not that the unknown surfaces have been proven healthy.

## Confidence

Confidence is separate from readiness:

- `High`: at least 85% evidence coverage and scan evidence newer than 24 hours
- `Medium`: at least 60% evidence coverage and scan evidence newer than 72 hours
- `Low`: an otherwise scoreable assessment whose evidence is older or less complete
- no confidence: insufficient evidence to emit a readiness score

## UI contract

`Needs assessment` means the system does not yet have enough weighted evidence to emit a percentage. Running a readiness assessment refreshes production evidence, recomputes the dimensions, and exposes every dimension as `verified`, `failing`, or `unknown` with its source and explanation.

The assessment must remain inspectable. The UI should always show:

- readiness percentage or `Needs assessment`
- evidence coverage
- confidence
- verified / failing / unknown counts
- dimension-level source and explanation

## Next evidence expansions

The next useful additions are browser-executed conversion/auth/mobile journeys, authoritative analytics-presence evidence, and executed first-user/agent journeys. Those should convert the corresponding `unknown` dimensions into observed evidence; they should not introduce a new cosmetic scoring system.

## Sandbox execution decision — 2026-09-15

There is no canonical product sandbox designated yet. Browser-executed launch-readiness work must not target production merely because a sandbox has not been configured.

Until a canonical sandbox exists:

- finish local and deterministic coverage without requiring a live product target
- report live browser execution as `unknown` when no authorized sandbox is configured; absence of credentials or a configured journey is not a product failure
- document the sandbox contract before live integration, including required environment-variable names, isolation requirements, disposable test-account expectations, and non-destructive checkout behavior
- do not invent sandbox URLs, credentials, or secret names
- keep sandbox evidence explicitly labeled and prevent it from raising production-readiness scores

**ALVIRA is the intended first live sandbox target**, but no existing ALVIRA deployment should be connected until its backend, authentication, analytics, and Stripe/payment configuration are verified to be genuinely non-production. A Vercel preview that still points at production services does not qualify as a sandbox.

This decision is a product/safety boundary, not a blocker for completing the browser-execution implementation or its local tests.
