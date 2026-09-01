# Scoped Work Item Contract Proposal

Status: **proposal only**. This document does not authorize implementation, execution, deployment, production access, schema migration, secret access, or cross-product automation.

## Problem

ailhat can identify portfolio-level opportunity, risk, drift, and work, but the product boundary becomes weaker if every downstream environment requires a custom interpretation of what ailhat meant.

The proposal is to define a small, portable **Work Item Contract** that carries product intelligence out of ailhat without turning ailhat into the execution system.

The contract should answer one question:

> What should a downstream human or governed workforce understand about this proposed piece of work before deciding whether and how to act?

## Product boundary

The Work Item Contract preserves the ecosystem separation of responsibilities:

- **ailhat owns product / portfolio intelligence:** what matters next, why it matters, and the evidence behind that judgment.
- **ALVIRA owns durable person and operating context:** goals, preferences, history, constraints, identity, and relevant working context.
- **ALVIRA Bridge carries approved context:** it delivers the minimum relevant context to a selected tool or agent without becoming the source of truth.
- **LEDGATo / the authorization layer owns permission decisions:** what a downstream agent may read, use, mutate, or share.
- **Agent OS / Workforce owns governed execution composition:** which agents, skills, and workflows are appropriate after work is accepted and authorized.
- **The human remains the decision point where approval is required.**

ailhat therefore does **not** own execution-capacity allocation simply because it created the work item.

## Proposed contract

This is a conceptual shape, not a committed runtime schema.

A portable work item should be able to carry:

- stable work item id;
- source product and source reference;
- product / portfolio subject;
- signal type, such as `opportunity`, `risk`, `drift`, or `work`;
- concise title and problem statement;
- rationale: why this matters now;
- evidence references with provenance and epistemic status preserved;
- priority and confidence, where available;
- known constraints and dependencies;
- proposed outcome;
- success / verification signal;
- context requirements expressed as references or categories rather than copied sensitive context;
- authorization requirements or expected permission class;
- lifecycle state and timestamps;
- optional downstream outcome/evidence references when work returns to ailhat.

The contract should be intentionally smaller than a workflow definition. It describes the **meaning of the work**, not the full mechanism for doing it.

## Relationship to shared context

The Work Item Contract should compose with `shared-context/v1`; it should not replace `ContextEnvelope` or create a second context model.

A work item may reference context needed for execution, but approved context should be resolved and delivered through the appropriate context layer. Sensitive or private context should not be embedded merely for transport convenience.

Likewise, evidence attached to the work item must preserve its original status. A founder assertion does not become verified evidence because it appears in a work item.

## Explicit non-goals

This proposal does not make ailhat:

- a workflow DSL;
- an agent orchestrator;
- a scheduler or queue manager;
- a secrets transport;
- an authorization engine;
- a production deployment system;
- a direct mutation path into product repositories;
- the owner of downstream agent selection or execution capacity.

It also does not require ALVIRA Bridge, LEDGATo, or Agent OS to adopt a specific implementation. The boundary should be portable enough that each layer can integrate later through its own approved contract.

## Working lifecycle

```text
portfolio signal / evidence
        ↓
ailhat interpretation
        ↓
portable work item
        ↓
human decision / authorization as required
        ↓
approved context delivery
        ↓
governed workforce / tool execution
        ↓
verification + new evidence
        ↓
ailhat learns from outcome
```

The value of the contract is the continuity of meaning across this path, not automation for its own sake.

## Falsifiable acceptance criteria

A later implementation experiment should be considered successful only if:

1. the same work item can be understood by at least two downstream execution environments without ailhat-specific custom prose;
2. downstream consumers can distinguish evidence, assertions, uncertainty, and constraints without silent promotion of epistemic status;
3. required context can be requested by reference/category instead of embedding unrestricted user context in the item;
4. authorization and execution can be handled outside ailhat without losing the intent or success criteria;
5. outcome evidence can return to ailhat and be associated with the originating item;
6. ailhat does not need to become a workflow engine or credential holder to make the loop useful.

If useful downstream execution requires ailhat to own orchestration, secrets, or authorization, the proposal should be revisited rather than expanding scope by default.

## Gated next step

A future PR may propose a versioned schema, fixtures, and a non-production adapter experiment. That work requires separate approval and must keep implementation, merging, production access, and secrets explicitly gated.
