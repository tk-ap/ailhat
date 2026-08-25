// Agent Direct — directive-output engine (the directive layer).
//
// Turns a modeled workspace (the prioritized "do this next" action) into a
// canonical, provenance-preserving WORK ITEM, then deterministically compiles
// it into four injectable directive formats:
//   (a) a readable Markdown brief an agent can act on,
//   (b) a structured JSON payload,
//   (c) tool/schema definitions for the target interface,
//   (d) a TOON-style directive (compact, parseable, single-block).
//
// PURE + DETERMINISTIC: no browser globals, no fs, no Date.now() inside the
// compilers — the same WorkItem always compiles to the same bytes. This mirrors
// the R1 `recomputeReadiness()` pattern so the compiler is trivially testable.
// `buildWorkItem` is the ONLY place time enters (via the caller's nowMs).
//
// Honesty discipline (never break it):
//   - Every fact in the directive carries provenance: source + timestamp +
//     `evidenceBasis` (computed-live / anchored-seed / unassessed).
//   - Availability is DISCLOSED CONTEXT, never a promise. The capacity framing
//     is an exact sentence: a visible-page snapshot, NOT confirmation an agent
//     is idle, usage is available, or a slot is reserved.
//   - Seed window labels ("next free Builder window") are NEVER emitted. The
//     JSON keeps only an allocation note stating they are reference labels.
//   - No invented readiness deltas, no derived capacity times.

import { impactLabel, leaderReason } from "./control-scoring";
import type { ModeledWorkspace } from "./control-scoring";
import type { SlotState } from "./agent-control";
import type { LiveOverlay } from "./observations";
import { recommendSkillsFor, SKILLS_NOTE } from "./directiveSkills";
import type { SkillRef } from "./directiveSkills";

/** Reused from R1: how the directive's inputs were derived. */
export type EvidenceBasis = ModeledWorkspace["evidenceBasis"];

export interface WorkItemEvidence {
  /** What is actually true (a fact, never a promise). */
  fact: string;
  /** Where the fact came from (seed baseline / live scan / live observation). */
  source: string;
  /** ISO timestamp of the fact. */
  timestamp: string;
  /** Provenance tier of THIS fact. */
  basis: EvidenceBasis;
  kind: "readiness" | "capacity" | "scan" | "blocker" | "priority";
}

export interface WorkItem {
  schema: "ailhat.agent-direct.work-item/v1";
  /** Stable id: `${workspace}:${action}` — unchanged by recompiles. */
  id: string;
  generatedAt: string;
  workspace: { id: string; name: string; url: string | null; stage: string };
  title: string;
  problem: string;
  opportunity: string;
  priority: { points: number; reason: string };
  effort: string;
  executionMode: { role: string; harness: string };
  expectedImpact: { launch: string; customer: string };
  source: { label: string; note: string };
  evidenceBasis: EvidenceBasis;
  evidence: WorkItemEvidence[];
  contextSnapshot: {
    readiness: number | null;
    confidence: string | null;
    distanceLabel: string;
    blockers: { id: string; title: string; severity: string }[];
    slots: { harness: string; state: SlotState; work?: string }[];
    lastScanLabel: string;
    evidenceLabel: string;
    evidenceIso: string;
  };
  capacity: {
    targetHarness: string;
    sharedWith: string[];
    hasLive: boolean;
    cap: number | null;
    provider: string | null;
    observedAtIso: string | null;
    tier: "High" | "Medium" | "Low" | null;
    staleness: string | null;
    /** The exact honest capacity-framing sentence (see module doc). */
    framing: string;
    /** Seed reference-label disclaimer — no live slot is implied. */
    allocationNote: string;
  };
  /** Optional — never required to execute. */
  recommendedSkills?: SkillRef[];
}

/** Parses "engineer · cto.new Builder (sample)" → "cto.new Builder". */
function harnessFromAgent(agent: string): string {
  const part = agent.split("·").pop()?.trim() ?? agent.trim();
  return part.replace(/\s*\(sample\)\s*$/i, "").trim();
}

/** Shared cto.new Builder bucket consumers (PORTFOLIO_AND_AGENT_CONTROL.md). */
const SHARED_CONSUMERS: Record<string, string[]> = {
  ledgato: ["ALVIRA Bridge"],
  bridge: ["Ledgato"],
};

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/**
 * Build the canonical work item for a modeled workspace's TOP action. Pure —
 * same inputs, same output. `bucket` is the shared cto.new Builder observation
 * from the Control payload (used only for shared-bucket consumers).
 */
export function buildWorkItem(
  m: ModeledWorkspace,
  nowMs: number,
  opts?: { bucket?: LiveOverlay | null },
): WorkItem {
  const ws = m.ws;
  const action = m.nextActions[0];
  const title =
    action?.title ??
    m.blockers[0]?.title ??
    `${ws.name}: assess current state before scheduling work`;
  const role = action?.role ?? "engineer";
  const effort = action?.effort ?? m.estimatedEffort;

  const readinessFact =
    m.readiness == null
      ? "Launch readiness: NEEDS ASSESSMENT — no percentage invented without a live scan."
      : `Launch readiness: ${m.readiness}% (confidence ${m.confidence ?? "unstated"}).`;
  const readinessSource =
    m.evidenceBasis === "computed-live"
      ? "computed from live scan/observation evidence anchored on the seeded baseline"
      : m.evidenceBasis === "anchored-seed"
        ? "seeded directional baseline (no live evidence yet)"
        : "unassessed — no readiness figure exists";

  const harness = harnessFromAgent(ws.recommendedAgent);
  const sharedWith = ws.sharedBucket ? (SHARED_CONSUMERS[ws.id] ?? []) : [];

  // Capacity context: the workspace's own live observation, else the shared
  // bucket's observation for shared-bucket consumers, else none (never invented).
  const overlay = m.live ?? (ws.sharedBucket ? (opts?.bucket ?? null) : null);
  const hasLive = !!overlay;
  const cap = hasLive ? (overlay.cap != null ? overlay.cap : null) : null;
  const capLabel = cap != null ? `${cap}%` : "not detected";
  const observedLabel = hasLive ? iso(overlay.observedAt) : "never (no live observation)";
  const tier = hasLive ? overlay.tier : null;
  const tierLabel = tier ? `${tier.toLowerCase()} freshness confidence` : "no freshness confidence (reference baseline only)";

  const framing = [
    `Suggested target harness: ${harness}${sharedWith.length ? ` (shared with ${sharedWith.join(" / ")})` : ""}.`,
    `Latest observed capacity context: ${capLabel}, observed ${observedLabel}, ${tierLabel}.`,
    "Important: this is a visible-page capacity snapshot, not confirmation that an agent is idle, usage is available, or a slot is reserved — verify in the harness before starting.",
  ].join(" ");

  const allocationNote =
    "Allocation context: reference label only (seed data) — no live slot is scheduled, claimed, or implied. Verify capacity in the harness before starting.";

  const evidence: WorkItemEvidence[] = [
    {
      fact: readinessFact,
      source: readinessSource,
      timestamp: m.evidenceIso,
      basis: m.evidenceBasis,
      kind: "readiness",
    },
    ...(m.scan
      ? [
          {
            fact: `Live scan ${m.scan.ok ? "ok" : "unreachable"} · ${m.scan.totalFailures} open finding(s) (${m.scan.findings.CRITICAL}C / ${m.scan.findings.HIGH}H / ${m.scan.findings.MEDIUM}M) · ${m.scan.staleness}`,
            source: "live site scan (site-scan observation feed)",
            timestamp: iso(m.scan.scannedAt),
            basis: "computed-live" as const,
            kind: "scan" as const,
          },
        ]
      : [
          {
            fact: "No live scan evidence recorded yet for this workspace — findings/readiness deltas are never inferred.",
            source: "observation feed (absence of site-scan rows)",
            timestamp: m.evidenceIso,
            basis: "anchored-seed" as const,
            kind: "scan" as const,
          },
        ]),
    {
      fact: hasLive
        ? `Live availability observed ${capLabel} (${overlay.provider ?? "provider"}), staleness tier ${tierLabel}.`
        : `No live availability observation recorded for ${harness} — reference baseline only.`,
      source: hasLive
        ? "live availability observation (Agent Direct capacity feed)"
        : "observation feed (absence of availability rows)",
      timestamp: hasLive ? iso(overlay.observedAt) : m.evidenceIso,
      basis: hasLive ? ("computed-live" as const) : ("anchored-seed" as const),
      kind: "capacity",
    },
    ...m.blockers.map((b) => ({
      fact: `Blocker (${b.severity}): ${b.title}`,
      source: "portfolio seed baseline",
      timestamp: m.evidenceIso,
      basis: m.evidenceBasis,
      kind: "blocker" as const,
    })),
    {
      fact: `Ranked ${m.priority} pts — ${leaderReason(m)}.`,
      source: "ailhat · Agent Direct work model (deterministic scoring)",
      timestamp: m.evidenceIso,
      basis: m.evidenceBasis,
      kind: "priority",
    },
  ];

  const skillHay = `${title} ${m.blockers.map((b) => b.title).join(" ")}`;
  const recommendedSkills = recommendSkillsFor(skillHay);

  const item: WorkItem = {
    schema: "ailhat.agent-direct.work-item/v1",
    id: `${ws.id}:${action?.id ?? "top-action"}`,
    generatedAt: iso(nowMs),
    workspace: { id: ws.id, name: ws.name, url: ws.url, stage: ws.stage },
    title,
    problem: ws.summary,
    opportunity: `${impactLabel(action?.launchImpact ?? ws.launchImpact)} launch impact · ${impactLabel(action?.customerImpact ?? ws.customerImpact)} customer impact · ${m.distanceLabel}`,
    priority: { points: m.priority, reason: leaderReason(m) },
    effort,
    executionMode: { role, harness },
    expectedImpact: {
      launch: impactLabel(action?.launchImpact ?? ws.launchImpact),
      customer: impactLabel(action?.customerImpact ?? ws.customerImpact),
    },
    source: {
      label: "ailhat · Agent Direct",
      note: "Work item derived deterministically from the modeled portfolio; seeded baseline unless evidenceBasis is computed-live.",
    },
    evidenceBasis: m.evidenceBasis,
    evidence,
    contextSnapshot: {
      readiness: m.readiness,
      confidence: m.confidence,
      distanceLabel: m.distanceLabel,
      blockers: m.blockers,
      slots: Object.entries(ws.interfaces).map(([h, slot]) => ({
        harness: h,
        state: slot.state,
        ...(slot.work ? { work: slot.work } : {}),
      })),
      lastScanLabel: ws.lastScan,
      evidenceLabel: m.evidenceLabel,
      evidenceIso: m.evidenceIso,
    },
    capacity: {
      targetHarness: harness,
      sharedWith,
      hasLive,
      cap,
      provider: hasLive ? overlay.provider : null,
      observedAtIso: hasLive ? iso(overlay.observedAt) : null,
      tier,
      staleness: hasLive ? overlay.staleness : null,
      framing,
      allocationNote,
    },
    ...(recommendedSkills.length > 0 ? { recommendedSkills } : {}),
  };
  return item;
}

// ---- Deterministic compilers -------------------------------------------------

function readinessLine(item: WorkItem): string {
  const c = item.contextSnapshot;
  return c.readiness == null
    ? "needs assessment (no % invented)"
    : `${c.readiness}% (confidence ${c.confidence ?? "unstated"})`;
}

function blockersLine(item: WorkItem): string {
  const b = item.contextSnapshot.blockers;
  return b.length ? b.map((x) => `${x.title} [${x.severity}]`).join("; ") : "none recorded";
}

function slotsLine(item: WorkItem): string {
  return item.contextSnapshot.slots
    .map((s) => `${s.harness}=${s.state}${s.work ? `:${s.work}` : ""}`)
    .join(" ");
}

function skillsLines(item: WorkItem, line: (s: SkillRef) => string): string[] {
  if (!item.recommendedSkills?.length) return [];
  return item.recommendedSkills.map(line);
}

/** (a) Markdown brief — readable, copy/paste into any agent chat or notes. */
export function compileMarkdown(item: WorkItem): string {
  const c = item.contextSnapshot;
  const basisNote =
    item.evidenceBasis === "computed-live"
      ? "computed from live evidence (anchored on the seeded baseline)"
      : item.evidenceBasis === "anchored-seed"
        ? "seeded directional baseline — no live evidence yet"
        : "unassessed — no readiness figure exists";
  const skills = skillsLines(
    item,
    (s) => `- **${s.name}** — ${s.url} — ${s.why}`,
  );
  const lines = [
    `# Directive — ${item.title}`,
    ``,
    `**Workspace:** ${item.workspace.name} · ${item.workspace.stage}${item.workspace.url ? ` · ${item.workspace.url}` : ""}`,
    `**Generated:** ${item.generatedAt} · **Source:** ${item.source.label} · **Evidence basis:** ${item.evidenceBasis} (${basisNote})`,
    ``,
    `## Objective`,
    item.title,
    ``,
    `## Why it matters`,
    `- ${item.opportunity}`,
    `- Priority: **${item.priority.points} pts** — ${item.priority.reason}`,
    `- Estimated effort: ${item.effort}`,
    ``,
    `## Context snapshot`,
    `- Launch readiness: ${readinessLine(item)}`,
    `- Distance to first paid client: ${c.distanceLabel}`,
    `- Blockers: ${blockersLine(item)}`,
    `- Per-interface agent slots: ${slotsLine(item)}`,
    `- Last scan: ${c.lastScanLabel}`,
    ``,
    `## Evidence (with provenance)`,
    ...item.evidence.map(
      (e) => `- ${e.fact} _(basis: ${e.basis} · source: ${e.source} · ${e.timestamp})_`,
    ),
    ``,
    `## Execution`,
    `- Suggested execution mode: **${item.executionMode.role}**`,
    `- ${item.capacity.framing}`,
    `- ${item.capacity.allocationNote}`,
    ...(skills.length
      ? [
          ``,
          `## Optional skills to install (examples from antigravityskills.directory)`,
          ...skills,
          ``,
          `_${SKILLS_NOTE}_`,
        ]
      : []),
    ``,
    `## Honesty constraints`,
    `- Never fabricate scan data, readiness deltas, or capacity windows.`,
    `- ${item.capacity.framing}`,
    `- Provenance tier on this directive: **${item.evidenceBasis}**.`,
    ``,
    `## After completion`,
    `- Report what was done (evidence → completion event).`,
    `- Rescan the workspace so readiness/confidence update from live evidence.`,
    ``,
  ];
  return lines.join("\n");
}

/** (b) Structured JSON payload — the canonical work item, closed + serializable. */
export function compileJson(item: WorkItem): string {
  return JSON.stringify(item, null, 2);
}

/** (c) Tool/schema definitions — function-tool shape for the target interface. */
export function compileTools(item: WorkItem): string {
  const tool = {
    schema: "ailhat.agent-direct.tool/v1",
    for: item.capacity.targetHarness,
    allocation: {
      reference: "seed label only — no live slot implied, reserved, or scheduled",
      capacity: item.capacity.framing,
    },
    tool: {
      type: "function",
      function: {
        name: `ailhat_execute_${item.workspace.id.replace(/[^a-z0-9]/gi, "_")}_${(item.id.split(":").pop() ?? "action").replace(/[^a-z0-9]/gi, "_")}`,
        description: item.title,
        strict: false,
        parameters: {
          type: "object",
          properties: {
            workspace: { type: "string", const: item.workspace.name },
            objective: { type: "string", description: item.title },
            problem: { type: "string", description: item.problem },
            opportunity: { type: "string", description: "expected impact framing" },
            launch_impact: { type: "string", description: item.expectedImpact.launch },
            customer_impact: { type: "string", description: item.expectedImpact.customer },
            effort: { type: "string" },
            role: { type: "string", enum: [item.executionMode.role] },
            evidence_basis: { type: "string", enum: ["computed-live", "anchored-seed", "unassessed"] },
            evidence: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  fact: { type: "string" },
                  source: { type: "string" },
                  timestamp: { type: "string" },
                  basis: { type: "string" },
                  kind: { type: "string" },
                },
                required: ["fact", "source", "timestamp", "basis"],
              },
            },
            context: {
              type: "object",
              properties: {
                readiness: { type: ["number", "null"], description: readinessLine(item) },
                confidence: { type: ["string", "null"] },
                distance_to_first_paid_client: { type: "string" },
                blockers: {
                  type: "array",
                  items: { type: "object", properties: { title: { type: "string" }, severity: { type: "string" } } },
                },
                slots: {
                  type: "string",
                  description: slotsLine(item),
                },
              },
            },
            ...(item.recommendedSkills?.length
              ? {
                  recommended_skills: {
                    type: "array",
                    description: "OPTIONAL — never required to execute",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        name: { type: "string" },
                        url: { type: "string" },
                        why: { type: "string" },
                      },
                    },
                  },
                }
              : {}),
          },
          required: ["workspace", "objective", "evidence_basis", "evidence", "context"],
        },
      },
    },
    ...(item.recommendedSkills?.length
      ? { recommended_skills: item.recommendedSkills.map((s) => ({ id: s.id, name: s.name, url: s.url, why: s.why })) }
      : {}),
  };
  return JSON.stringify(tool, null, 2);
}

/** (d) TOON-style directive — compact single-block, parseable, complete. */
export function compileToon(item: WorkItem): string {
  const c = item.contextSnapshot;
  const lines = [
    `#DIRECT v1 · ${item.schema}`,
    `@workspace ${item.workspace.name} · ${item.workspace.id} · ${item.workspace.stage}`,
    `@objective ${item.title}`,
    `@problem ${item.problem}`,
    `@opportunity ${item.opportunity}`,
    `@impact launch=${item.expectedImpact.launch} customer=${item.expectedImpact.customer} priority=${item.priority.points}pts`,
    `@priority_reason ${item.priority.reason}`,
    `@effort ${item.effort}`,
    `@mode role=${item.executionMode.role} harness=${item.capacity.targetHarness}`,
    `@capacity ${item.capacity.framing}`,
    `@allocation ${item.capacity.allocationNote}`,
    `@evidence_basis ${item.evidenceBasis}`,
    `@evidence`,
    ...item.evidence.map((e) => `  - ${e.fact} [${e.basis} · ${e.source} · ${e.timestamp}]`),
    `@context readiness=${readinessLine(item)} distance=${c.distanceLabel} blockers=${blockersLine(item)} slots=${slotsLine(item)}`,
    ...(item.recommendedSkills?.length
      ? [`@skills (optional)`, ...skillsLines(item, (s) => `  - ${s.name} — ${s.url} — ${s.why}`), `  note: ${SKILLS_NOTE}`]
      : []),
    `@verify verify capacity in the harness before starting; never invent readiness deltas, scan data, or capacity windows; keep provenance on every fact.`,
    `@done report completed work as a completion event, then rescan the workspace so readiness/confidence update from live evidence.`,
    ``,
  ];
  return lines.join("\n");
}

export interface CompiledDirectives {
  markdown: string;
  json: string;
  tools: string;
  toon: string;
}

/**
 * Compile a work item into all four directive formats. Pure + deterministic:
 * the same item always produces identical output bytes.
 */
export function compileDirectives(item: WorkItem): CompiledDirectives {
  return {
    markdown: compileMarkdown(item),
    json: compileJson(item),
    tools: compileTools(item),
    toon: compileToon(item),
  };
}