# Market signal — model routing and multi-model workflows

**Date:** 2026-09-05
**Lane:** external market / engagement signal (canonical source order position 5)
**Triggered by:** owner question — "considering everything in my ecosystem, as well as Agent OS itself, goose.ai and getmulti.ai, how can we leverage, if at all?"
**Status:** dated decision record; refreshed 2026-09-25. Proposes work; does not authorize execution.

---

## SIGNAL

Two external products were evaluated against the portfolio. One is a decline, one is an adjacent comparable. Neither is recommended as an integration or dependency.

| Product | Assessment |
|---|---|
| **GooseAI** (`goose.ai`) | **Decline.** Capability floor is below what ALVIRA's AI paths require. |
| **Multi** (`getmulti.ai`) | **Track as adjacent comparable.** No build, no integration. |

The material finding is not either vendor. It is that evaluating Multi surfaced an unexamined single-provider dependency inside ALVIRA — see `PORTFOLIO_RELEVANCE`.

## EVIDENCE

Observed directly from each vendor's public site on 2026-09-05. Vendor language is quoted rather than paraphrased.

### GooseAI

- Self-described as "NLP-as-a-Service", a "Joint Venture by CoreWeave and Anlatan".
- Positioning is cost substitution: "feature parity with industry standard APIs" at "30% the cost", switchable "by changing minimal code".
- Published model lineup: GPT-Neo 1.3B, GPT-J 6B, Fairseq 13B, GPT-NeoX 20B. Pricing $0.000110–$0.002650 per request.
- Question-answering and classification are listed "Coming Soon".

**Operating status: unknown.** The page carries no shutdown notice and an active signup form, but the model lineup is 2021–2022 era and the roadmap items remain unshipped. Per the evidence rules in `docs/PORTFOLIO_EVIDENCE_ARCHITECTURE.md`, this is recorded as unknown rather than inferred dormant. Confirm before any future reconsideration.

### Multi

- Positioning quote: "no single model wins at everything."
- Unified access to "300+ language models" across OpenAI, Anthropic, Google, xAI, DeepSeek and others.
- Four named workflow modes: **Let Multi Choose** (automatic routing), **One Answer**, **Compare Answers** (2–4 models side by side), **Panel Verdict** (up to seven models answer, one synthesises).
- **Free Mode** offering zero-cost model access with no paid fallback; live web research; transparent cost tracking with model-selection rationale.
- Users bring their own OpenRouter API key; Multi adds no markup.
- Pricing: **$19/month** (first 30 days free) or **$399 lifetime**.

## PORTFOLIO_RELEVANCE

### 1. Multi is adjacent to ALVIRA, not overlapping

The boundary is clean and worth stating in one line:

> Multi answers *"which model should answer this?"* ALVIRA answers *"what should the model know about you?"*

This is the same class of adjacent comparison already recorded for Littlebird and Creed in the ALVIRA launch-readiness lineage. It is a positioning datapoint, not a competitive threat to Context Intelligence.

### 2. Pricing comparable

Multi charges $19/month or $399 lifetime. ALVIRA charges $20/month with a lifetime tier. An adjacent product converged independently on nearly the same pricing shape. This is a comp for lifetime pricing, not validation of demand.

### 3. The material finding — ALVIRA has no model fallback

Repository evidence (`tk-ap/ALVIRA`, source order position 2): `gpt-4o` is hardcoded in five server functions —

```
src/routes/-extractor.ts          src/routes/-questionGenerator.ts
src/routes/-meosCompiler.ts       src/routes/-buildBrief.ts
src/routes/-foundingBetaAIReview.ts
```

Single provider, single model, no fallback path. A provider incident takes every AI capability in ALVIRA down simultaneously, including the interview, which is the product. Two of those call sites have materially different requirements — question generation is conversational and latency-sensitive, compilation is structured and quality-sensitive — and both call the same model.

This was not visible in the 2026-09-05 ALVIRA public-surface audit, which observed production behaviour only.

Note the ecosystem principle this touches: Agent OS and ailhat both hold that hosts and harnesses are replaceable and must not be hardcoded as the execution layer. Model providers are the same class of dependency and currently do not get the same treatment.

## INTERPRETATION

Cost substitution is the wrong lever for ALVIRA. The compiled Context files are the product, so extraction quality is the value, not inference price. GooseAI's entire pitch is price, on models that cannot hold structured JSON output or resist prompt injection — both of which `-extractor.ts` depends on today.

Multi's thesis — that task shape should determine model choice — is directionally sound and is already true inside ALVIRA without being acted on. The leverage is the internal observation, not the vendor. Acting on it requires no external dependency: Hermes already ships `fallback` and `moa` capabilities in owned tooling.

Bridge is the only surface where a Multi-style aggregator would create real reach, since one integration would cover many models rather than per-tool work for ChatGPT, Claude, Gemini and Cursor. That is not actionable yet: `/api/bridge/context` returns 401 for authenticated users and nothing links to `/bridge` in either auth state (ALVIRA work item `alvira-launch-readiness-2026-09-05`, P1.1 and P1.2). Surfaces should not be added to Bridge before Bridge works.

## RECOMMENDED_EXPERIMENT

One bounded experiment, proposed to `alvira-meos`, filed as `.agent-os/work-items/alvira-model-fallback-2026-09-05.json`:

Introduce a single model-selection helper with a declared fallback provider, and route the five hardcoded call sites through it. Scope is resilience and configurability — not model shopping, not a routing product, not a Multi integration.

Explicitly **not** recommended:
- Any GooseAI adoption.
- Any Multi integration or partnership approach.
- Any Bridge integration work before P1.1 and P1.2 are resolved.

## SUCCESS_SIGNAL

- No single provider outage can disable every AI path in ALVIRA.
- Model choice per call site is a configuration decision with a recorded rationale, rather than a literal repeated in five files.
- A model change requires editing one location.

## LEARNING

`registry/vendor-acquisition.yaml` in Agent OS is scoped entirely to **skill** sources — agentic-awesome-skills, vercel-labs/agent-skills, agentmail-skills, anti-slop, taste-skill — and carries `status: plan-only` with an activation rule for making skills executable.

Neither GooseAI nor Multi is a skill. They are external products and services, and the ecosystem has no registry, evaluation lane, or decision record for that class. This evaluation had no canonical home before this document.

**Ecosystem gap:** capability acquisition is governed; vendor/product evaluation is not. Recommend a vendor-evaluation lane owned by ailhat that produces a filed decision record — decline, track, or propose work — so questions of the form "should we use X?" leave evidence instead of remaining conversational. This document is the first instance of that shape and can serve as its template.

---

## REFRESH — 2026-09-25

This refresh preserves the 2026-09-05 assessment as a historical snapshot and
rechecks the public vendor surfaces before merging this record.

### Current external evidence

- **GooseAI remains available as a narrow managed completion API.** Its public
  site still presents GPT-Neo, GPT-J, Fairseq, and GPT-NeoX engines, output-token
  pricing, and an OpenAI-compatible completions endpoint. Question-answering and
  classification remain marked “Coming Soon” on the public product surface.
  Sources: [GooseAI](https://goose.ai/),
  [GooseAI pricing](https://goose.ai/pricing), and
  [GooseAI engine API](https://goose.ai/docs/api/engines).
- **Decision unchanged: decline GooseAI for ALVIRA.** The public evidence shows
  a functioning, narrowly scoped service, but does not establish the structured
  output, prompt-injection, reliability, or model-quality properties ALVIRA's
  context pipeline requires. Operating status is now **publicly present, but
  production suitability remains unverified** — not “dormant.”
- **Multi remains an active adjacent comparable.** Its current public surface
  describes one-answer, compare, council, and automatic-routing workflows over a
  large model catalog, with BYO OpenRouter credentials and free-model mode. Its
  published price remains **$19/month** or **$399 lifetime**. Sources:
  [Multi](https://getmulti.ai/) and
  [Multi terms](https://app.multi-ai.ai/en/terms).
- **Decision unchanged: track Multi; do not integrate it.** The product is
  evidence that task-shaped model choice is a live market pattern, not evidence
  of ALVIRA demand or a reason to add a vendor dependency. The model-count claim
  varies across Multi's public pages, so this record intentionally does not treat
  the catalog number as a stable metric.

### Internal finding status

The ALVIRA single-provider observation remains the proposed reason for a bounded
fallback experiment, but the canonical `tk-ap/ALVIRA` `main` branch was not
reachable during this refresh. The five-call-site grep from 2026-09-05 is
therefore retained as **repository evidence with stale-verification status**, not
reissued as a current production fact. Reconfirm the call sites and any existing
fallback work in ALVIRA before implementation authorization.

### Dated decision

As of 2026-09-25:

1. Decline GooseAI as an ALVIRA provider dependency.
2. Track Multi as an adjacent comparable; no integration or partnership work.
3. Keep the ALVIRA fallback item **proposed P2**, pending canonical-repository
   re-verification and explicit owner authorization.
4. Preserve the original 2026-09-05 snapshot and this refresh as separate
   evidence points; neither authorizes a cross-product code change.

## Boundary check

- ailhat proposed work and did not authorize or perform it.
- No ALVIRA repository content was modified; the model-fallback item is a proposal owned by `alvira-meos`.
- Context Intelligence, workforce routing, and authorization boundaries are unchanged.
- No adjacent product is made mandatory to complete any current workflow, per `policies/CROSS_MARKET_POLICY.md`.
