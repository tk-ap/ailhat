# ailhat — Embedded Build Brief Direction

**Status:** owner-approved product direction — 2026-09-08

## Decision

ailhat should be treated as an **embedded Portfolio Intelligence capability inside ALVIRA Build Brief first**, rather than requiring users to adopt ailhat as a standalone product experience.

This is a direction/positioning decision only. It does **not** authorize changes to the live ailhat site, ALVIRA site, deployment configuration, theme system, or runtime behavior.

## First product surface

The first serious user-facing expression should be downstream of ALVIRA Context and Build Brief:

**ALVIRA understands the person/project → Build Brief structures the current job → ailhat identifies what deserves attention across the active work.**

Core outputs remain:

- **Opportunity** — useful leverage or opening the user may not have noticed.
- **Risk** — material threat, contradiction, dependency, or unproven assumption.
- **Drift** — evidence that current activity is moving away from goals, proof milestones, or accepted direction.
- **Work** — a bounded next action worth routing to the owner, Agent OS, or the owning system.

## Why embedded first

Standalone Portfolio Intelligence currently carries a category-education burden.

A separate product asks the user to first understand:

> Why do I need Portfolio Intelligence?

Embedded inside Build Brief, the value can be experienced through a simpler question:

> Given what ALVIRA knows about me, this project, and my active work, what important thing should I notice or do next?

This lets the product prove the intelligence before asking the market to adopt a new category.

## Architecture boundary

Keep responsibilities separate:

- **ALVIRA** — Context Intelligence; maintained human/project context + reviewed working brief.
- **ailhat** — Portfolio Intelligence; interprets context across active work and returns Opportunity / Risk / Drift / Work.
- **Agent OS** — execution infrastructure; carries approved work through tasks, workflows, harnesses, hosts, state, handoffs, and evidence.
- **LEDGATo** — authority/enforcement when consequential agent execution requires governed boundaries.
- **Human** — acceptance and judgment.

ailhat must not absorb execution, generic workflow management, authorization, or generic analytics simply because it is embedded downstream of Build Brief.

## Standalone product posture

Do not delete the ailhat codebase, engine, category thesis, or internal identity.

Instead:

- preserve ailhat as a distinct internal intelligence capability;
- deprioritize standalone public positioning and broad surface expansion;
- validate value through embedded usage first;
- require evidence before re-elevating ailhat into a separate public product journey.

Evidence that could justify independent product status later:

1. repeated use of Opportunity / Risk / Drift / Work outside Build Brief;
2. users wanting portfolio monitoring across systems without ALVIRA as the main context source;
3. demand for persistent portfolio-level observation as its own job;
4. evidence that embedding materially constrains rather than helps the capability;
5. willingness to pay specifically for the portfolio-intelligence job.

## Design / theme inheritance — intentionally unresolved

Do **not** implement the embedded UI yet.

Before any live change, explicitly design and review:

- whether `ailhat` appears by name or operates invisibly inside ALVIRA;
- how Opportunity / Risk / Drift / Work should be represented visually;
- which ALVIRA tokens, components, typography, spacing, and motion behavior should be inherited;
- whether ailhat retains any distinct visual signal inside the ALVIRA surface;
- whether the experience should be inline, a result mode, contextual panel, progressive disclosure layer, or another pattern;
- how the experience behaves on mobile;
- how to prevent Build Brief from becoming a kitchen-sink dashboard;
- how evidence/provenance/confidence is exposed without overwhelming the main task.

The live sites remain unchanged until this interaction and theme inheritance are intentionally resolved.

## Validation question

Do not ask first whether users understand the term "Portfolio Intelligence."

Test instead:

> Does this intelligence reliably surface something useful and non-obvious that changes what the user notices, prioritizes, tests, stops, or routes into work?

If the answer is no, embedded placement does not rescue the product.

If the answer is yes, then evaluate whether users want the capability independently.

## Near-term priority

ailhat remains a **hold/validate** product relative to LEDGATo, Agent OS, and ALVIRA proof milestones.

Near-term work should favor:

- defining a clean input/output contract for embedded intelligence;
- grounding every signal in real context/evidence;
- avoiding generic recommendations;
- validating Opportunity / Risk / Drift / Work against real Build Brief cases;
- measuring whether users act differently because of the intelligence.

Avoid:

- broad standalone feature expansion;
- public category-building campaigns before evidence;
- new dashboards simply to preserve separate-product identity;
- duplicating ALVIRA Context or Agent OS execution state.

## Working thesis

**ailhat becomes an embedded intelligence capability first; standalone product status becomes something it has to earn through demand.**
