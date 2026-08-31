# ailhat Founding Beta and Commercial Rails

## Decision

ailhat should separate three concerns from the beginning:

1. **Owner role** — internal product administration and business visibility.
2. **Founding Beta entitlement** — temporary, invite-only customer access in exchange for product feedback.
3. **Commercial plan** — future paid/free packaging and billing state.

These are deliberately not the same field. A Founding Beta member is not a paid user, and the owner account is not a commercial plan.

## Owner account

The canonical owner email is controlled by `AILHAT_OWNER_EMAIL` and defaults to `tahlia.ashwood@gmail.com`.

`/owner` is owner-only and provides:

- total accounts
- active Founding Beta members
- open beta invitations
- waitlist / intent count
- aggregate active portfolio products
- beta feedback volume and recent feedback
- cohort member activity proxies
- invite creation and beta revocation
- explicit commercial-rail status

Owner access never derives from a paid plan.

## Founding Beta

Initial target: **5–10 real builders**.

Recommended initial access window: **45 days**.

Invitation links expire after **7 days** by default.

Founding Beta users receive unrestricted access to customer-facing ailhat functionality available during their access window. They do not receive:

- `/owner`
- cohort metrics
- other users' portfolios
- commercial/admin controls
- internal founder diagnostics

Founding Beta exists to answer product questions, not to simulate revenue.

### Feedback exchange

An active beta member receives a persistent `Founding Beta · Feedback` control. Feedback is stored with:

- category (`worked`, `confusing`, `broke`, or observation)
- free-text feedback
- current route
- account id
- timestamp

Portfolio contents, scan findings, and private product data are not automatically attached to a feedback report.

## Signup architecture

The existing `/api/auth/signup` remains the first-owner signup path.

Founding Beta members use a separate invite-only flow:

`owner creates invite → /beta?invite=... → invited email creates account → entitlement activates → normal login thereafter`

This avoids reopening general public signup before ailhat is ready.

## Commercial plan rail

`account_plans` exists before billing so product code can depend on a stable commercial abstraction without choosing prices prematurely.

Initial internal default:

- `plan_key = free`
- `status = active`
- `source = internal`

Future plan keys can be added without changing owner or Founding Beta semantics.

No Stripe/customer/billing identifiers are introduced in this phase.

## What should determine pricing later

Do not choose pricing primarily from model/token cost. ailhat's customer value is portfolio attention and decision leverage.

Use Founding Beta evidence to learn which dimensions correlate with repeat value:

1. **Active portfolio size** — how many products a builder actively asks ailhat to understand.
2. **Observation depth/cadence** — how frequently users need fresh evidence and change detection.
3. **Intelligence actions** — recommendations reviewed, accepted, dismissed, or acted on.
4. **Direct / execution handoffs** — how often intelligence becomes delegated work.
5. **Facilitation / learning use** — whether users pay for guided capability-building, not merely scanning.
6. **Connections** — whether cross-platform/source coverage creates a meaningful willingness-to-pay step.
7. **Team use** — only after multiple collaborators actually appear; do not invent seat pricing in advance.

## Pricing questions for the first cohort

At the end of the beta, ask behavior-grounded questions rather than generic willingness-to-pay prompts:

- What would become painful again if ailhat disappeared tomorrow?
- Which ailhat output changed what you worked on next?
- How many active products need to be in ailhat before it becomes indispensable?
- Which connection or intelligence source would make you trust it more?
- Which action would you expect to be included versus usage-metered?
- Would you personally expense it, use a company card, or need team approval?

## Candidate packaging hypotheses — not commitments

Only test these after cohort data exists:

- **Portfolio-size packaging:** price increases with the number of active products under intelligence.
- **Intelligence-depth packaging:** basic observation vs deeper market/research/facilitation layers.
- **Operator packaging:** individual builder vs multi-person operating portfolio.
- **Execution packaging:** Portfolio Intelligence subscription with governed execution as a separate usage/capacity rail.

Avoid pricing by raw number of scans if that encourages users to scan less and undermines ailhat's continuous-intelligence promise.

## Principle

The beta should optimize for **learning velocity and retained product behavior**, not early vanity revenue. Paid conversion becomes meaningful only after ailhat can identify what users repeatedly rely on and what resource/value dimension actually scales.
