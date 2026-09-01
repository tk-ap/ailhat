# ailhat Launch Readiness & Opportunity Routing

## Decision

Do **not** create a separate “AI website launch rescue” product. Absorb the underlying customer problem into ailhat as a Portfolio Intelligence capability.

The opportunity reveals two related ailhat capabilities:

1. **Launch Readiness** — evidence-based verification that a product is actually ready to receive users.
2. **Opportunity Routing** — determine whether a newly discovered idea should become a new venture or strengthen something already in the portfolio.

These capabilities should reinforce ailhat's role as Portfolio Intelligence rather than expand the public product portfolio unnecessarily.

---

## Launch Readiness

A successful build or deployment is not the same thing as a successful launch.

Launch Readiness should answer:

> This product says it is ready to launch. Does the available evidence agree?

ailhat should be able to inspect or ingest evidence across launch-critical surfaces such as:

- deployment and runtime health
- broken routes and dead links
- forms and conversion paths
- responsive/mobile behavior
- authentication and account flows
- domain, DNS, and SSL state
- metadata and basic SEO
- accessibility basics
- browser/console/runtime errors
- analytics/measurement presence
- primary CTA behavior
- first-user journey completion
- known blockers and unresolved P0/P1 work

The output should be evidence-backed rather than a cosmetic score. A readiness score may summarize the evidence, but the evidence, provenance, confidence, blockers, and next actions must remain inspectable.

Example:

> **Launch Readiness · 71%**
>
> 3 launch blockers detected: mobile navigation collision, failed contact-form submission, and missing production analytics.

Do not imply a live check occurred when a signal is simulated, stale, inferred, or unavailable.

### Product boundary

ailhat should **not** become a website repair agency or execution harness.

The intended loop is:

**Observe → Verify readiness → Detect blocker → Prioritize → Create work item → Workforce/agentic harness executes → ailhat rescans → Readiness updates**

This keeps execution harness-agnostic while making launch verification part of Portfolio Intelligence.

### Facilitation connection

Launch Readiness should also feed Facilitation when repeated launch failures reveal an operator-level learning opportunity.

Example:

> Two of your last three launches encountered the same mobile-navigation failure. This appears to be a recurring launch pattern rather than a one-off defect.

The resulting loop can become:

**Detect → Explain → Facilitate → Fix → Verify**

Facilitation should teach or explain the underlying pattern only when doing so is grounded in portfolio/workforce evidence; it should not become generic launch-course content.

---

## Opportunity Routing

ailhat should help prevent unnecessary portfolio sprawl.

When the user discovers a new business idea, market opportunity, trend, competitor pattern, or customer problem, Portfolio Intelligence should not default to “start another company.” It should first ask:

> Does this opportunity warrant a new venture, or does it reveal a capability that should strengthen something already in the portfolio?

### Routing outcomes

A newly discovered opportunity should be classifiable as:

- `NEW_VENTURE` — sufficiently distinct problem, customer, business model, and strategic thesis to justify a separate product.
- `FEATURE` — belongs inside an existing product's current promise.
- `CAPABILITY` — expands what an existing product can reliably do without becoming a separate offering.
- `INTEGRATION` — value is best captured by connecting an external system/source/platform.
- `EXPERIMENT` — worth validating before product commitment.
- `IGNORE` — weak fit, distraction, redundant, or insufficient evidence.

### Routing evidence

The recommendation should consider at minimum:

- problem overlap with existing products
- target-customer overlap
- intelligence-category fit
- existing product architecture and primitives
- strategic differentiation
- portfolio complexity introduced
- maintenance burden
- opportunity cost
- monetization implications
- evidence strength
- whether the idea strengthens an existing moat
- whether the portfolio already contains a natural owner

The system should show **why** an opportunity was routed rather than returning an opaque classification.

Example:

> **Recommendation: CAPABILITY → ailhat**
>
> The “AI website launch rescue” opportunity addresses a last-mile launch verification problem already adjacent to ailhat's Portfolio Intelligence role. The core value can be captured as Launch Readiness without introducing a new brand, product surface, customer relationship, or execution stack.

### External opportunity sources

Opportunity signals may eventually originate from sources such as:

- IdeaBrowser or similar opportunity-discovery products
- customer conversations
- product analytics
- portfolio scans
- market/trend research
- competitor observations
- founder notes
- repository/build history

An external source is evidence/input, not product truth. Preserve source, timestamp, confidence, and any assumptions.

---

## Relationship to the ailhat architecture

These capabilities extend the existing loop:

**Portfolio Intelligence → Facilitation → Workforce → Execution → Portfolio Intelligence**

Launch Readiness primarily belongs to **Portfolio Intelligence** and supplies work/evidence to Workforce and Facilitation.

Opportunity Routing belongs to **Portfolio Intelligence** and determines where a new signal should be absorbed before execution begins.

Agent OS / Workforce remains foundational infrastructure, not a separate public offering. Agentic harnesses perform generalized execution. Agent Control governs authorization/capacity/spend where applicable. ailhat remains the intelligence and recommendation layer.

## Product principle

**Prefer portfolio compounding over portfolio proliferation.**

A newly discovered opportunity should create a new product only when the evidence shows that the existing portfolio does not contain a credible natural owner.

Otherwise, route the insight into the product where it increases capability, differentiation, learning, or customer value without unnecessary organizational surface area.
