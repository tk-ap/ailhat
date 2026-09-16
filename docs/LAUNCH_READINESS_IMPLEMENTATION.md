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

## Sandbox test-access UI direction — 2026-09-15

ailhat should let a user configure sandbox/test-account access at the product UI level rather than requiring manual environment-variable setup for each product.

Suggested surface:

`Product → Environments → Sandbox → Test access`

The UI should accept:

- sandbox URL
- dedicated test username/email
- test-account password/secret
- optional account scope or role, such as standard test user vs. admin test user
- a `Verify access` action

After save, the UI must never reveal the stored secret again. It should show only state such as `Credential configured`, last verification time, and actions to replace or revoke the credential.

### Storage and runtime boundary

ailhat should not behave like a password notebook. The product database may store the sandbox URL, username, account scope, verification metadata, and a secret reference, but not a readable plaintext password.

For an initial low-cost implementation, the submitted password may be encrypted server-side and stored as ciphertext in the existing backend/database. The master encryption key must live only in a server-side environment secret and must not be stored alongside the ciphertext. This design should preserve a later migration path to a dedicated secrets manager or vault.

At runtime:

1. an authorized browser journey requests the test credential;
2. the server resolves/decrypts it only for that execution;
3. the secret is supplied to the browser runner;
4. the secret must not be included in prompts, screenshots, evidence, logs, analytics, portfolio-intelligence context, or persisted execution artifacts;
5. execution discards the usable secret after the journey completes.

Credential material is **execution authority, not evidence**.

### Scope boundary

The initial credential UI is for **sandbox/test credentials only**. Production credentials are out of scope. Test accounts should be dedicated/disposable where practical, limited to the minimum permissions required for the journey, and independently revocable.

A configured credential must not by itself change Launch Readiness. Only observed journey results may update the corresponding evidence dimensions, and sandbox observations must remain labeled as sandbox evidence rather than being promoted to production proof.

## Product Cockpit implementation status — 2026-09-15

Sandbox test access is now surfaced directly in each Product Cockpit. The implemented panel supports:

- HTTPS sandbox URL
- test username/email
- standard or admin test-account scope
- password creation/replacement without ever returning the saved plaintext to the client
- explicit credential revocation
- visible configured / last-verification state

The backing API is owner-only in the current single-owner release. Passwords are encrypted with AES-256-GCM before persistence. Ciphertext, IV, and authentication tag are stored in the existing database; plaintext is available only to the server-only execution resolver.

The deployment requires one server-side master secret named `AILHAT_CREDENTIAL_ENCRYPTION_KEY`. It must be either a 32-byte value encoded as base64 or a 64-character hex value. Never commit this value to the repository or expose it to client code.

`Verify access` remains intentionally disabled until the live browser-journey executor is connected. Saving a credential is configuration only: it must not set `last_verified_at`, close an unknown readiness dimension, or count as launch evidence.
