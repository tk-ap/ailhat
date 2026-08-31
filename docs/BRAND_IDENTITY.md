# ailhat brand identity — Condensation

## Working direction

**ailhat** is the Portfolio Intelligence layer in the ecosystem.

The working visual identity is **Condensation**: many distributed signals resolving toward one clear intelligence point.

The mark should feel precise, infrastructural, observant, and slightly atmospheric — not decorative, mystical, wellness-oriented, or like a literal water-drop brand.

## Name and meaning

The name began personally: **ailhat is Tahlia reversed**.

There is a real etymological throughline worth preserving accurately. **Tahlia** is commonly used as a modern spelling/variant in the broader Talia/Talya name family. The established Hebrew **Talia/Talya** derivation comes from `tal` (dew) + `Yah` (a divine name), giving the sense **“dew from God” / “God’s dew.”** The exact spelling **Tahlia** also has modern English/Australian usage, so product copy should avoid claiming that every historical use of the exact spelling has one single Hebrew origin.

For the brand story, the dew meaning is still unusually coherent with the product:

- small signals accumulate before they are obvious;
- unseen conditions become visible through their evidence;
- freshness matters because stale evidence is dangerous;
- clarity emerges from distributed observation;
- the useful output is not the raw signal field, but what condenses from it.

A useful conceptual sentence is:

> Dew is visible evidence of conditions that were already present. ailhat does the same for a product portfolio.

The name story is supporting brand context, not the primary category explanation.

Suggested About copy:

> **Why ailhat?** The name began personally — Tahlia, reversed. Talia/Talya also carries a Hebrew meaning associated with dew from God. That became an unexpectedly accurate metaphor for the product: ailhat watches a portfolio continuously, gathering small changes, weak signals, and evidence until something worth acting on becomes visible.

## Category lockup

Primary lockup:

**ailhat**  
**PORTFOLIO INTELLIGENCE**

Do not use **COMMAND CENTER** as the primary descriptor. It is too generic and makes ailhat sound like a control plane rather than a distinct intelligence category.

## Condensation mark

Canonical vector asset:

`/public/brand/ailhat-condensation.svg`

Favicon:

`/public/favicon.svg`

### Visual logic

The mark contains:

1. sparse outer observations / weak signals;
2. a denser interior field;
3. one bright central resolved point.

This represents:

`observe → accumulate → resolve → act`

The mark is intentionally radial without being a literal droplet. At small sizes the central point must remain legible even when peripheral particles visually simplify.

### Motion language

When motion is appropriate, use the brand behavior rather than ornamental animation:

1. points appear asynchronously;
2. relevant points tighten toward the center;
3. noise fades;
4. the resolved node sharpens;
5. a recommendation/action becomes available.

This is especially appropriate for:

- observation/loading states;
- Intelligence recomputation;
- signal resolution;
- transitions into prepared Direct work.

Do not use constant particle motion simply as background decoration.

### Signature reverse wordmark reveal

The wordmark carries a second, more personal motion cue: **ailhat illuminates from right to left**.

The visual sequence should imply:

`t → a → h → l → i → a`

That direction subtly acknowledges that `ailhat` resolves back to **Tahlia** when read in reverse. It should not literally replace the displayed word with Tahlia; the reference should remain discoverable rather than explanatory.

Implementation rules:

- one-pass reveal on first meaningful brand appearance;
- approximately 1.2–1.5 seconds;
- right-to-left blue/violet illumination, then settle to the normal neutral wordmark;
- no continuous pulsing or looping;
- never use the animation as a live-data/status indicator;
- respect `prefers-reduced-motion` and render a static wordmark when motion is reduced.

Current implementation:

`/public/brand/ailhat-motion.css`

## Core verbal idea

Preferred tagline:

> **Signals condensed into clarity.**

This is the canonical working tagline for the Condensation direction.

Supporting lines:

- **What matters becomes visible.**
- **Portfolio signals, resolved.**
- **Small signals become visible before they become obvious.**
- **What changed overnight becomes clear by morning.**

Use the more poetic morning/dew language sparingly. Product surfaces should remain operational and evidence-led.

## Product-system vocabulary

The Condensation concept should reinforce the information architecture rather than replace it.

- **Portfolio** — membership: what ailhat is actively reasoning about.
- **Today** — attention: what deserves the user's operating surface now.
- **Intelligence** — judgment: what changed, why it matters, and what ailhat recommends.
- **Product Cockpit** — depth: evidence, history, reasoning, lifecycle, and product-specific context.
- **Direct** — action: accepted intelligence compiled into prepared, governed work.

Useful conceptual flow:

`signals → intelligence → prepared work → outcome evidence`

## Ecosystem relationship

The products should share a visual standard without becoming interchangeable.

- **ALVIRA — Context Intelligence**: understands the context.
- **ailhat — Portfolio Intelligence**: sees what matters across the portfolio.
- **LEDGATo — Authorization Intelligence**: governs what is allowed to happen.

Short ecosystem articulation:

> **Understand. Observe. Govern.**

or

> **Three intelligences. One ecosystem.**

Agent OS / Workforce remains foundational infrastructure and is not treated as a fourth public product in this brand lockup.

## Color direction

Working ailhat palette should remain compatible with the broader ecosystem while preserving its own signal identity.

Primary signal blue: `#5EA6FF`  
Resolution violet: `#8B5CFF`  
Light signal / core: `#9CC8FF`  
Deep background: `#0B0F17`  
Secondary dark: `#141820`  
Primary light text: `#F2F4F7`

Blue/violet should communicate observation → resolution. Avoid overusing gradients across ordinary UI controls; keep them concentrated in brand/signaling moments.

## UI application

### App shell

Replace the temporary letter tile with the Condensation mark.

Desktop brand block:

**ailhat**  
`PORTFOLIO INTELLIGENCE`

Mobile may use the icon + `ailhat` without the descriptor when space is constrained.

The right-to-left wordmark illumination is appropriate here as the first subtle brand reveal.

### Intelligence

The brand metaphor should be reflected through reduction:

- fewer simultaneous visual hierarchies;
- one resolved lead recommendation;
- compact secondary signals;
- evidence expanded only when requested or viewed in Product Cockpit.

Condensation does **not** mean showing more particles/data. It means turning complexity into clarity.

## Guardrails

Do not:

- use a literal water-drop as the primary logo;
- describe ailhat as a generic command center;
- use dew/morning language on every screen;
- make the mark resemble a crypto token, galaxy illustration, or loading spinner;
- let the peripheral particle detail compromise favicon/sidebar recognition;
- loop the reverse wordmark animation continuously;
- use `Ailhat` capitalization in product copy — write **ailhat** lowercase.

## Status

**Condensation is the current working identity direction.**

It can evolve after in-product testing, but future changes should preserve the underlying idea: distributed portfolio evidence resolving into actionable clarity.
