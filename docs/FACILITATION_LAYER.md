# ailhat Facilitation Layer

## Purpose

ailhat should not stop at detecting what matters. Portfolio Intelligence becomes substantially more useful when it can help the user understand a finding, learn the relevant operating pattern, make a sound decision, and build the capability required to act on it.

The **Facilitation layer** is the bridge between:

**Portfolio Intelligence → understanding → capability-building → governed action → measured outcome**

This is an ailhat capability, not a separate public product.

## Product thesis

Most portfolio tools either report status or recommend actions. ailhat should become a system that can also help a user become better at operating the portfolio itself.

When ailhat detects an opportunity, risk, drift, blocker, or important work item, it should be able to answer four questions:

1. **What is happening?** — evidence-backed portfolio intelligence.
2. **Why does it matter?** — consequence, urgency, and expected impact.
3. **What do I need to understand or learn before acting?** — facilitation.
4. **What is the safest next move?** — a guided action or portable work item for the broader agentic workforce.

The result should feel less like a dashboard issuing directives and more like an intelligent operating partner that develops the user's judgment and execution capability over time.

## Facilitation is not a generic learning app

Do not turn ailhat into an LMS, course marketplace, or detached tutorial product.

Learning should be **contextual, progressive, and attached to live work**.

Examples:

- A portfolio scan detects that a product has no reliable first-value path. ailhat explains the concept, shows the evidence from that product, walks the user through how to evaluate the path, and tracks whether the resulting intervention improves conversion or readiness.
- A user wants to build an agent workforce. ailhat can guide the user through workforce design principles, skill coverage, handoff quality, evaluation, and productivity while grounding each lesson in the user's actual portfolio and active projects.
- A recommendation requires an unfamiliar technical or operating concept. ailhat inserts a short facilitation step before dispatch rather than assuming the user already understands the recommendation.

## Core facilitation capabilities

### 1. Contextual lessons

Generate short, interactive learning modules from real portfolio conditions rather than presenting a fixed curriculum first.

A lesson should include:

- the concept
- why it is relevant now
- evidence from the current product or portfolio
- a worked example
- a decision or exercise
- a confidence check
- an optional deeper path
- a clear connection to the live initiative

### 2. Guided build mode

For work the user wants to understand rather than simply delegate, ailhat should provide a step-by-step facilitated path.

Examples include:

- designing an agent workforce
- defining agent responsibilities
- selecting or evaluating skills
- improving agent handoffs
- creating evaluation criteria
- understanding harness tradeoffs
- measuring workforce productivity
- improving product readiness
- validating recommendations before execution

The user should be able to switch between **teach me**, **guide me**, and **prepare for delegation** without changing products.

### 3. Progress and capability tracking

Track more than task completion.

Useful state can include:

- concepts introduced
- concepts demonstrated
- confidence level
- exercises completed
- live applications of the concept
- recurring failure patterns
- interventions that improved outcomes
- areas where the user still needs support

This should produce a living capability profile, not a vanity learning score.

### 4. Real-time assistance and feedback

During live work, ailhat should be able to review a plan, prompt, agent design, workflow, handoff, evaluation, or decision and provide immediate feedback tied to the current objective.

Feedback should distinguish:

- factual/evidence problems
- weak reasoning
- missing context
- capability gaps
- execution risk
- authority constraints
- opportunities to delegate safely

### 5. Live-project continuity

Facilitation should continue after a lesson ends.

ailhat should remember that a concept was introduced and observe whether it is being applied successfully in future projects. When the same issue recurs, it can reference the prior intervention rather than restarting from zero.

The desired loop is:

**detect → explain → teach/guide → apply → dispatch if appropriate → observe result → reflect → adapt future guidance**

## Relationship to Agent OS / Workforce

**Agent OS / Workforce is not a separate ailhat offering.** It is a foundational infrastructure concept across the ecosystem.

ailhat may help the user **learn how to design, evaluate, and improve an agent workforce**, but ailhat must not become the canonical workforce registry, runtime, skill router, or authorization layer.

ailhat owns the facilitation experience around questions such as:

- What kind of agent capability is needed?
- What does good execution look like?
- What should I learn before delegating this?
- Is the proposed workforce design likely to succeed?
- Did the completed work improve the intended outcome?

The broader agentic-harness / Agent OS layer owns reusable agents, skills, routing, teams, and execution patterns. LEDGATo owns operational authorization/evidence where applicable. ALVIRA provides approved context and context distribution.

The product boundary is:

**ailhat develops understanding and turns intelligence into an outcome-backed initiative. The ecosystem executes through the appropriate governed harness.**

## User experience direction

Facilitation should be available at the moment it is useful rather than hidden in a separate education area.

Potential entry points:

- a finding: **Understand this**
- a recommendation: **Guide me through it**
- a work item: **Learn before delegating**
- workforce-related work: **Build with facilitation**
- completed execution: **Review what changed**

A dedicated Facilitation surface can exist for continuity and progress, but it should aggregate live learning already generated by the portfolio rather than becoming a separate disconnected course catalog.

## Facilitation object

A normalized facilitation record should be able to reference:

- `product_ref`
- `finding_ref`
- `initiative_ref`
- `objective`
- `concept`
- `why_now`
- `evidence_refs`
- `mode` (`teach`, `guide`, `prepare-to-delegate`, `review`)
- `steps`
- `user_confidence`
- `completion_state`
- `capability_signal`
- `work_item_ref`
- `outcome_ref`
- `created_at`
- `updated_at`

This can begin as application state; it does not require a new public service boundary.

## Product rules

1. **Portfolio evidence comes first.** Do not generate generic lessons when a live product context can ground the facilitation.
2. **Teach toward an objective.** Every facilitation path should connect to a real decision, initiative, or capability gap.
3. **Do not confuse learning with execution.** ailhat can prepare and evaluate work without becoming the execution runtime.
4. **Preserve user agency.** Facilitation should improve judgment, not pressure the user into automatic action.
5. **Measure transfer.** The strongest signal is whether the user or workforce applies the concept successfully later.
6. **Keep the ecosystem boundary visible.** ailhat = Portfolio Intelligence + facilitation; Workforce / Agent OS = infrastructure; LEDGATo = authorization/evidence; ALVIRA = context.

## Near-term implementation sequence

### Phase 1 — product framing

- add Facilitation as a first-class ailhat capability in product/agent documentation
- expose **Understand this** / **Guide me through it** language around findings and recommendations
- keep all functionality advisory; no new execution coupling

### Phase 2 — guided interaction

- add contextual micro-lessons generated from finding evidence
- add teach / guide / prepare-to-delegate modes
- persist basic lesson and confidence state

### Phase 3 — capability continuity

- connect facilitation records to initiatives and outcome events
- track recurring gaps and demonstrated capability
- adapt future guidance based on prior application

### Phase 4 — workforce facilitation

- add guided workforce-design and evaluation experiences
- measure productivity and handoff quality against portfolio objectives
- recommend broader Agent OS / harness execution paths when appropriate

## Success criteria

The Facilitation layer is working when a user can move from:

> "ailhat found something important"

through:

> "I understand why it matters and what good looks like"

into:

> "I can act myself, build the capability, or delegate it intelligently"

and ailhat can later determine whether that intervention actually improved the portfolio.
