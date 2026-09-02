# ailhat Portfolio Scope & Governed Action Handoff

## Purpose

ailhat should maintain a truthful operating picture across the user's portfolio without assuming that ailhat itself is the only place where product work happens.

Portfolio Intelligence should combine production observation, repository context, deployment evidence, ailhat history, and external market/engagement signals while preserving the provenance and authority scope of each source.

See `docs/PORTFOLIO_EVIDENCE_ARCHITECTURE.md` for the canonical evidence hierarchy.

## Ecosystem role

ailhat is **Portfolio Intelligence**:

**Observe → Reconcile evidence → Detect Opportunity / Risk / Drift / Work → Prioritize → Recommend → Verify**

ailhat also owns **Facilitation**:

**Learn → Apply → Observe → Improve**

Agent Direct is ailhat's user-facing handoff surface for turning an accepted evidence-backed decision into governed action. It does not grant authority or become the execution runtime.

Agent OS / Workforce is the host-agnostic control plane for task-first workforce composition, agents, skills, routing, handoffs, harness/host selection, execution policy, verification, and returned evidence.

Agent Control is the authorization-intelligence layer in the Agent OS control plane where integrated. It is not a separate public ailhat offering and should not be represented as ailhat's generic execution-capacity dashboard.

LEDGATo participates only when work materially intersects its defined governance or enforcement scope.

ALVIRA / MeOS owns Context Intelligence. ALVIRA Bridge is the gated secondary capability for approved context delivery.

The broader loop is:

**Portfolio Intelligence → Decide → Agent Direct → governed task / authorization as required → execution → evidence → Verify → Portfolio Intelligence**

## Portfolio identity model

A product should be represented by an identity bundle rather than a single live URL:

**Product → production URL(s) → repository/repositories → deployment project/environment → observations → decisions/work → verification history**

Repository and deployment links are optional, but recommended when available because they let ailhat distinguish user-facing reality from implementation activity and release state.

Useful identity fields include:

- `name`
- `slug`
- `state`
- `platform`
- `production_urls`
- `repo_refs`
- `deployment_refs`
- `description`
- `customer_target`
- `business_model`
- `launch_stage`
- `context_source`
- `context_updated_at`

Use nullable/unknown states when evidence is unavailable.

Do not hard-code a static portfolio table as canonical product truth. Product inventory should come from the user's current portfolio records and linked evidence sources.

## Evidence-aware product state

Every product may carry evidence-backed state such as:

- last production observation
- last repository activity observed
- last deployment observed
- last external market/engagement observation
- unresolved findings/work packages
- current lifecycle disposition
- verification state
- source freshness
- confidence and missing evidence

These timestamps answer different questions and must not be silently collapsed into one `last activity` field.

Examples:

- production quiet + repository active → **active build**
- repository changed + no matching production release → **deployment drift / pending release**
- deployment ready + original finding not rescanned → **external change / verification pending**
- production regressed after a release → **production regression**
- repository/spec direction differs from production → **spec / implementation drift**
- production, repository, deployment, and engagement all remain quiet across repeated observations → **dormancy review may be warranted**, but retirement still requires an explicit decision

## Lifecycle and retirement

Active portfolio attention is finite, but inactivity alone is not failure.

- Retirement is reversible state, not deletion.
- Never auto-retire a product.
- A quiet production site is not evidence of abandonment when repository or deployment activity shows an active build.
- A quiet repository is not evidence of failure when production engagement remains healthy.
- Missing analytics, repository, or deployment integration means the corresponding state is unknown.
- Retirement recommendations should use corroborating evidence appropriate to viability, not a fixed days-since-attention threshold.
- Retired products should leave prime active prioritization while preserving historical observations, decisions, outcomes, and evidence for later review/reactivation.

## Portfolio UI direction

The portfolio surface should help the user understand state across products without turning ailhat into a generic project-management dashboard.

Useful fields/surfaces include:

- current lifecycle state
- production status
- source freshness/provenance
- last meaningful external or internal evidence
- unresolved verified findings
- work that is active / externally changed / awaiting verification
- next evidence-backed recommendation
- repository/deployment connection state when available
- confidence and important unknowns

The UI should distinguish labels such as:

- **Observed in production**
- **Supported by repository**
- **Confirmed by deployment**
- **Observed in execution evidence**
- **User supplied**
- **Inferred**
- **Unknown / source unavailable**

## Work and Agent Direct

ailhat may prepare a portable work item containing the product intent and supporting evidence. The current runtime work-item contract should remain smaller than a workflow definition.

A work item may include:

- product/workspace reference
- title and observed problem/opportunity
- evidence and provenance
- reasoning / confidence / unknowns
- disposition
- proposed outcome
- acceptance / verification criteria
- context requirements by reference/category
- source observations
- lifecycle state

A work item does **not** reserve capacity, select a final executor, or grant execution authority.

Agent Direct should expose the handoff honestly:

**ailhat signal → evidence-backed work item → governed Agent OS task → authorization/policy as required → minimum workforce → harness/host → execution → outcome evidence → ailhat verification**

## External completion

ailhat must not interpret absence of ailhat-local completion as proof that nothing happened.

When outside evidence exists:

- GitHub merge/commit → evidence that implementation work occurred
- Vercel production Ready → evidence that a revision shipped
- Agent OS/harness outcome event → evidence about bounded execution and verification
- manual/user assertion → directional evidence until independently verifiable where verification is possible

External change should normally move relevant work to **verification pending**, not directly to **verified done**.

## Authorization and governance boundary

When accepted work requires authorization intelligence, ailhat/Agent Direct should produce or route the appropriate authorization request to the Agent OS control-plane authorization layer.

Agent Control may satisfy that internal authorization-intelligence role where integrated, but ailhat must not recreate it locally or present it as a separate public ailhat product.

LEDGATo is conditional: route to it only when the work materially intersects LEDGATo's governance/enforcement scope.

## Provenance rule

Conversation-derived strategy, user-supplied portfolio facts, repository content, production observations, deployment events, market evidence, and execution evidence retain distinct epistemic status.

Do not silently promote:

- intent in a repository → deployed capability
- merged code → verified resolution
- deployment Ready → user-validated outcome
- user assertion → observed fact
- missing source → zero activity

Conflicts between sources are themselves Portfolio Intelligence and should be surfaced for reconciliation.
