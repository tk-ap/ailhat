// Ailhat — Agent Direct WORKED DIRECTIVE EXAMPLES (education).
//
// Renders 3 well-formed, copyable injectable artifacts for real workspace
// scenarios, reusing the EXACT directive compiler (buildWorkItem +
// compileDirectives) shipped in PR #16. Nothing here is a mock — it is the real
// compiler run over clearly-labeled sample workspaces.
//
// DETERMINISM: `compileDirectives` and `buildWorkItem` are pure; `modelWorkspace`
// is pure given (workspace, nowMs). So this module pins a FIXED timestamp
// (EXAMPLE_NOW_MS) so the same bytes render on every visit. We never call
// Date.now() here — time only enters via the fixed constant, preserving the
// compiler's byte-identical guarantee for a given work item.

import type { Workspace } from "./agent-control";
import { modelWorkspace } from "./control-scoring";
import type { ModeledWorkspace } from "./control-scoring";
import { DEMO_PORTFOLIO } from "./demo-portfolio";
import { buildWorkItem, compileDirectives } from "./directives";
import type { CompiledDirectives, WorkItem } from "./directives";
import { recommendSkillsFor } from "./directiveSkills";
import type { SkillRef } from "./directiveSkills";

/** Fixed timestamp so worked examples are deterministic (2026-08-20T12:00:00Z). */
const EXAMPLE_NOW_MS = 1784707200000;

export interface WorkedExample {
  id: string;
  title: string;
  scenario: string;
  workspaceName: string;
  item: WorkItem;
  compiled: CompiledDirectives;
  skills: SkillRef[];
}

const FEATURED = [0, 1, 2]; // Acme Launchpad, Brightcart Storefront, Nimbus Docs

export function buildWorkedExamples(): WorkedExample[] {
  const out: WorkedExample[] = [];
  for (const idx of FEATURED) {
    const ws: Workspace = DEMO_PORTFOLIO[idx];
    const modeled: ModeledWorkspace = modelWorkspace(ws, EXAMPLE_NOW_MS);
    const item: WorkItem = buildWorkItem(modeled, EXAMPLE_NOW_MS);
    out.push({
      id: `example-${ws.id}`,
      title: item.title,
      scenario: describeScenario(idx),
      workspaceName: ws.name,
      item,
      compiled: compileDirectives(item),
      skills: recommendSkillsFor(`${item.title} ${modeled.blockers.map((b) => b.title).join(" ")}`),
    });
  }
  return out;
}

function describeScenario(idx: number): string {
  switch (idx) {
    case 0:
      return "A near-launch SaaS with an actionable checkout/billing blocker on a free interface — the 'push now' case.";
    case 1:
      return "An unassessed workspace with no readiness percentage — the 'NEEDS ASSESSMENT → scan first' case.";
    default:
      return "A live-but-quiet product that has sat silent — the 'neglected product still surfaces' case.";
  }
}

export const EXAMPLE_NOTE =
  "Worked examples run through the real Agent Direct directive compiler on clearly-labeled sample " +
  "workspaces. Copy or download them as templates for your own portfolio — the structure, provenance " +
  "stamps, and honest capacity framing are exactly what a directive should carry.";
