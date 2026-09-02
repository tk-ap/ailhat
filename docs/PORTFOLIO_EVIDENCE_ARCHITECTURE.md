# ailhat Portfolio Evidence Architecture

Status: canonical product-direction contract, v1.

ailhat is Portfolio Intelligence. It should understand the state, direction, and viability of a product from multiple evidence sources without pretending that any single source is complete.

The governing principle is:

> Production shows what users can experience. Repositories show what is being built and why. Deployment systems show what actually shipped. ailhat history shows how that state changed over time. Market signals show whether the product is earning attention or value.

No source silently overrides another. Conflicts between sources are themselves useful portfolio intelligence.

## Canonical evidence hierarchy

### 1. Production / live product

Production is the primary source for current user-facing reality.

Use it to answer questions such as:

- Is the product reachable?
- What does a visitor actually see?
- Does the intended user path work?
- Are accessibility, metadata, content, conversion, or runtime conditions present now?
- Does a previously observed defect still reproduce?

Production evidence MUST NOT be overwritten by repository intent. Code that exists but is not deployed is not a live capability.

### 2. Repository context

A linked site/product repository is an optional but recommended secondary context source.

Use repository evidence to understand:

- product intent and current implementation direction
- recent commits and active development
- open and merged pull requests
- linked issues and work packages
- routes, feature code, tests, migrations, and configuration
- documented product decisions and architecture
- work that may be complete but not yet deployed
- work that may have occurred outside ailhat

Repository evidence does not prove that a capability is live. Dead code, abandoned branches, stale documentation, feature flags, experiments, and unreleased work must remain distinguishable from production reality.

### 3. Deployment provider

Deployment evidence connects repository activity to production reality.

Use providers such as Vercel, Cloudflare, Netlify, Railway, Render, or another host to establish:

- which commit or source revision was deployed
- preview versus production environment
- deployment created / building / ready / failed state
- deployment timestamp
- domains and aliases associated with a release

A successful deployment is evidence that a change shipped. It is not automatically proof that the original product condition was resolved; verification should still inspect the relevant user-facing condition when possible.

### 4. ailhat history

ailhat should retain longitudinal product evidence including:

- prior observations and scans
- finding occurrence and differential history
- decisions and dispositions
- work packages
- external observations
- execution evidence
- verification results
- retirement/reactivation history

History allows ailhat to distinguish a one-time observation from persistence, regression, drift, or improvement.

### 5. External market and engagement signals

Viability reasoning should eventually incorporate evidence such as:

- traffic and engagement
- signups / activation
- usage
- revenue or paid conversion
- support and qualitative feedback
- search / demand signals
- customer or audience response

Lack of repository or production change alone is not proof that a product is inactive or non-viable. A quiet but healthy product may deserve continued active status.

## Product identity graph

ailhat should map evidence to a stable product identity instead of treating every source as a disconnected object.

Conceptual shape:

```ts
interface ProductEvidenceIdentity {
  productId: string;
  publicUrls: string[];
  repositories: Array<{
    provider: "github" | "gitlab" | "other";
    owner?: string;
    name: string;
    url: string;
    defaultBranch?: string;
  }>;
  deployments: Array<{
    provider: "vercel" | "cloudflare" | "netlify" | "railway" | "render" | "other";
    projectRef: string;
    productionDomains?: string[];
  }>;
  workspaces?: Array<{
    provider: "agent-os" | "agent-direct" | "other";
    ref: string;
  }>;
}
```

Repository and deployment connections should be optional. A product must remain usable in ailhat with only a public URL.

## Normalized external observation

External systems should normalize into a provider-neutral evidence object before they influence intelligence.

Conceptual shape:

```ts
interface ExternalObservation {
  id: string;
  productId: string;
  provider: "github" | "vercel" | "agent-os" | "agent-direct" | "manual" | "other";
  kind: "commit" | "pull_request" | "issue" | "deployment" | "execution" | "decision" | "engagement";
  state: "observed" | "started" | "merged" | "deployed" | "failed" | "completed" | "superseded";
  observedAt: number;
  sourceRef?: string;
  sourceUrl?: string;
  summary: string;
  authoritativeFor: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}
```

`authoritativeFor` matters. For example:

- GitHub can be authoritative that a PR merged.
- Vercel can be authoritative that a commit deployed successfully.
- the live site can be authoritative that a CTA is currently present.
- none of those alone is authoritative that the product is commercially viable.

## Provenance labels

User-facing intelligence should expose source provenance where useful:

- **Observed in production**
- **Supported by repository**
- **Confirmed by deployment**
- **Observed in execution**
- **User supplied**
- **Inferred**
- **Verification pending**

When sources disagree, ailhat should show the disagreement rather than collapsing it into a single unsupported conclusion.

## Reconciliation intelligence

Multi-source evidence enables higher-quality signals.

### Deployment drift

Repository change or merged work exists, but the production deployment does not include it.

### Active build

Production is quiet or unchanged while repository evidence shows meaningful current implementation work.

### External change / verification pending

GitHub, Agent Direct, agent-os, another harness, or manual evidence indicates that work changed, but ailhat has not yet verified the original condition in production.

### Production regression

A condition previously verified as resolved is observed again in production.

### Spec / implementation drift

Documented product direction and implementation evidence materially disagree.

### Dormancy / retirement review

Only consider retirement after corroborating signals. For example:

- sustained lack of meaningful production change
- sustained lack of repository activity
- no active execution evidence
- low or absent current engagement evidence

If repository or execution evidence shows active work, do not treat an unchanged production site as abandonment. If engagement evidence is healthy, do not treat low development activity as failure.

## Truthfulness rules

1. **Production is primary for current user-facing reality.**
2. **Repository evidence is secondary context, not a substitute for deployment or verification.**
3. **A merge is evidence of work; a deployment is evidence of release; verification determines whether the original condition is resolved.**
4. **Absence of ailhat-visible completion is not proof that no work occurred elsewhere.**
5. **Missing external integration means unknown, not zero.**
6. **Conflicting evidence should produce reconciliation work, not silent source precedence.**
7. **Viability conclusions require evidence appropriate to viability; implementation activity alone is insufficient.**

## External Evidence MVP

The first implementation should stay narrow:

1. allow an optional repository connection on each product
2. map product → public URL(s) → repository → deployment project
3. ingest GitHub commit / PR / issue observations
4. ingest deployment created / ready / failed observations from Vercel first
5. reconcile external observations with existing findings and work packages
6. represent `external change observed / verification pending`
7. offer **Verify now** when outside evidence plausibly affects a current finding
8. include recent external activity in queue, drift, dormancy, and retirement reasoning
9. preserve source URLs, timestamps, provider, confidence, and authority scope

Webhook ingestion should be preferred for timely events, with periodic reconciliation as a fallback for missed events and history.

## Non-goals

This architecture does not make ailhat:

- a source-code review product
- a generic GitHub dashboard
- a deployment platform
- the execution harness
- the authorization layer
- a substitute for product analytics or customer evidence

Repository and deployment connections exist to improve Portfolio Intelligence.

## Canonical loop

`Production observation + repository context + deployment evidence + execution evidence + market evidence → reconcile → decide → Direct / governed execution → new evidence → verify → update portfolio intelligence`
