# Ailhat — Cloudflare Integration Direction

## Purpose

This document captures the current owner-approved direction for evaluating Cloudflare as an **observation/intelligence layer** for Ailhat.

It is intentionally additive. **Do not migrate Ailhat off Vercel simply to use Cloudflare.**

The strategic question is:

> Can Cloudflare give Ailhat better eyes on the products it monitors?

The answer is potentially yes, especially through browser-based observation.

---

# 1. Architecture Direction

Keep the core application architecture centered on:

```text
Vercel
  └── Ailhat application / UX / Next.js

Neon
  └── Ailhat persistent product + observation + finding data

Cloudflare
  ├── Browser observation
  ├── Crawling / screenshots where useful
  ├── Background observation infrastructure where useful
  ├── Internet / market signals where useful
  └── AI infrastructure later, if justified
```

Do not introduce Cloudflare merely for infrastructure novelty.

Every Cloudflare component must make Ailhat better at:

> observing products → detecting meaningful changes → explaining what matters → recommending action.

---

# 2. P0 — Cloudflare Browser Observation

This is the highest-value Cloudflare integration to investigate first.

Ailhat's existing site scan should evolve from a basic HTML/site check into **real product observation**.

Current conceptual flow:

```text
Fetch URL
→ inspect HTML
→ identify objective issues
```

Target flow:

```text
Open product URL
→ render the actual application
→ inspect page/application state
→ inspect console errors
→ inspect network failures
→ inspect navigation and important interactions
→ capture screenshot/evidence where useful
→ extract structured observations
→ compare against previous observations
→ generate Ailhat findings
```

The important distinction is:

> Ailhat should observe the product as a user experiences it, not merely inspect its source HTML.

---

# 3. Browser Observation Examples

Potential findings should include things such as:

- JavaScript/client-side errors
- failed network requests
- broken navigation
- broken forms
- important CTA failures
- pages that fail to render
- visual/layout regressions where reliably detectable
- unexpected redirects
- missing critical page elements
- responsive behavior problems where testable
- changed page structure/content
- screenshots that provide evidence for a finding

Example:

```text
🔴 ACT NOW

Signup button is rendering but fails when clicked.

WHY IT MATTERS

The primary acquisition path appears broken.

EVIDENCE

✓ signup interaction produced a client-side error
✓ network request failed
✓ failure reproduced during latest observation

RECOMMENDATION

Inspect the signup request and latest deployment.

[Open evidence]
[Investigate]
```

Do not surface every browser observation. The intelligence layer must filter and prioritize.

---

# 4. Observation Must Remain Non-Blocking

Ailhat's dashboard should never wait for a complete browser observation before rendering.

Preferred:

```text
render known state
      ↓
start background observation
      ↓
collect evidence
      ↓
compare with history
      ↓
update findings
      ↓
recalculate attention
```

If observation fails, preserve the last successful state.

Example:

```text
Could not update Product A.

Last successful observation:
18 minutes ago

[Retry]
```

---

# 5. Observation History Is Required

Cloudflare browser observation is only valuable to Ailhat if results can be compared over time.

Persist observations conceptually as:

```text
Observation
- productId
- timestamp
- source
- status
- structured findings
- evidence
- screenshot/reference where applicable
```

Compare:

```text
previous observation
        vs.
current observation
```

Classify findings as:

```text
NEW
PERSISTING
RESOLVED
REGRESSED
```

Do not treat each scan as an isolated report.

---

# 6. Browser Observation + GitHub + Vercel

The highest-value future architecture is cross-signal reasoning.

Ailhat should eventually correlate:

```text
GitHub change
      +
Vercel deployment
      +
Cloudflare browser observation
      ↓
Ailhat finding
```

Example:

```text
🔴 ACT NOW

Checkout appears to have regressed after the latest deployment.

EVIDENCE

✓ checkout code changed in recent commit
✓ deployment occurred shortly afterward
✓ production checkout interaction now fails
✓ network request returns an error

RECOMMENDATION

Inspect the latest deployment and checkout changes.

CONFIDENCE
HIGH
```

This synthesis is substantially more valuable than showing three disconnected integration feeds.

---

# 7. Cloudflare Radar — Later / P2

Cloudflare Radar may become useful for Ailhat's longer-term market and Internet intelligence layer.

Potential use:

```text
Ailhat product context
+
competitor/product observations
+
technology trends
+
Internet/network signals
=
market opportunity context
```

Do not make Radar a dependency for the core MVP.

Do not generate unsupported market-share claims.

Prefer language such as:

- observed trend
- potential opportunity
- evidence strength
- emerging capability
- market signal

Avoid fabricated precision such as:

> "You are missing 17% market share."

unless there is actual data supporting that claim.

---

# 8. Cloudflare Workers / Background Processing — Later

Cloudflare Workers and related background primitives may be useful for scheduled observation and asynchronous work.

Potential model:

```text
scheduled observation
        ↓
run browser observation
        ↓
collect evidence
        ↓
compare history
        ↓
generate finding
        ↓
update Ailhat
```

Do not move core application hosting from Vercel merely to accomplish this.

Use Cloudflare where it provides a clear capability advantage.

---

# 9. Cloudflare AI Infrastructure — Later / Optional

Cloudflare AI infrastructure such as AI Gateway or Workers AI may eventually be useful for model routing, observability, caching, or inference infrastructure.

This is **not a current product priority**.

Do not spend engineering time on AI infrastructure while Ailhat's core observation/intelligence loop remains incomplete.

The priority is:

```text
better observations
→ better evidence
→ better reasoning
→ better recommendations
```

not:

```text
more sophisticated model infrastructure
```

---

# 10. What NOT To Do

Do not:

- migrate Ailhat off Vercel solely because Cloudflare is available
- introduce Cloudflare services without a concrete product benefit
- build a generic Cloudflare monitoring dashboard
- expose raw browser telemetry to users as the product
- create hundreds of low-value browser findings
- make browser scanning synchronous/blocking
- replace Ailhat's intelligence layer with Cloudflare output
- treat Cloudflare as the product moat

Cloudflare is infrastructure/capability.

**Ailhat's value is the interpretation.**

---

# 11. Recommended Implementation Order

If engineering capacity is limited:

## P0

1. Persist product observations.
2. Introduce observation history.
3. Upgrade site scan into real browser-based observation.
4. Capture structured evidence.
5. Detect NEW / PERSISTING / RESOLVED / REGRESSED findings.
6. Feed observations into the Ailhat attention engine.

## P1

7. Connect GitHub.
8. Connect Vercel.
9. Correlate GitHub + Vercel + browser observations.
10. Generate evidence-backed recommendations.

## P2

11. Add feedback learning.
12. Add cross-product portfolio intelligence.
13. Explore Cloudflare Radar / Internet signals for market intelligence.
14. Evaluate Cloudflare background infrastructure where operationally useful.

## P3

15. Evaluate AI Gateway / Workers AI only if scale, cost, routing, or observability creates a concrete need.

---

# 12. Product North Star

Cloudflare should help Ailhat fulfill this promise:

> **Ailhat watches everything you're shipping and tells you what matters next.**

The strongest future experience is:

```text
User connects product.
        ↓
Ailhat continuously observes it.
        ↓
Ailhat notices a meaningful change.
        ↓
Ailhat gathers evidence.
        ↓
Ailhat correlates the change with code/deployment/context.
        ↓
Ailhat explains why it matters.
        ↓
Ailhat recommends what to do.
        ↓
User acts.
        ↓
Ailhat learns from the outcome.
```

The key strategic principle:

> **Cloudflare can give Ailhat eyes. Ailhat's intelligence layer must decide what those eyes mean.**

---

# 13. Agent Acceptance Criteria

Any Cloudflare integration is successful only if it improves one or more of these outcomes:

- Ailhat detects a real issue that a basic HTML scan would miss.
- Ailhat detects a meaningful change between observations.
- Ailhat provides concrete evidence for a finding.
- Ailhat correlates browser evidence with code/deployment evidence.
- Ailhat produces a recommendation that is more useful than raw telemetry.
- Ailhat reduces the user's need to manually monitor their products.

If an implementation does not improve one of these outcomes, defer it.

---

# 14. Current Decision

**Approved direction:** investigate Cloudflare as an observation layer.

**Primary candidate:** Cloudflare Browser Run / browser-based observation.

**Keep:** Vercel as Ailhat's application/deployment platform.

**Do not prioritize yet:** Cloudflare AI infrastructure, Radar, or broad infrastructure migration.

**Strategic goal:** make Ailhat capable of observing a product like a user, synthesizing evidence across systems, and telling the builder what deserves attention.
