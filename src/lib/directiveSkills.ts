// Agent Direct — optional task-skill recommendations.
//
// This is the "skills to install" seam from the education spec: a SMALL, static,
// curated map from task keywords to REAL public agent skills indexed by
// antigravityskills.directory (each entry links directly to its public SKILL.md
// in the source repo — we link, we never bundle third-party skill content).
//
// Deliberately optional and additive: `recommendSkillsFor` can return [] and
// directive compilation must never depend on it. Selections are heuristic
// keyword matches on the work item's title/blockers — this is curated example
// mapping for the MVP, NOT a live catalogue query. The UI labels the block
// "example recommendation — verify latest URL" so it is never mistaken for a
// live lookup or an endorsement of a specific repo.

export interface SkillRef {
  id: string;
  name: string;
  /** Direct link to the skill's public SKILL.md (antigravityskills.directory index). */
  url: string;
  /** One-line why-this-skill-for-this-task rationale. */
  why: string;
}

interface SkillEntry extends SkillRef {
  /** Lowercased keywords matched against the work item's title + blocker text. */
  keywords: string[];
}

// Public SKILL.md links verified live against the directory's skills-index.json
// (all returned HTTP 200 at commit time; treat as curated examples).
const SKILL_CATALOG: SkillEntry[] = [
  {
    id: "k6-load-testing",
    name: "k6 Load Testing",
    url: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/k6-load-testing/SKILL.md",
    keywords: ["load", "stress", "scalab", "peak", "capacity check", "traffic"],
    why: "Writing and executing load tests for HTTP/WebSocket endpoints — fits 'load checks' and reliability hardening.",
  },
  {
    id: "slo-implementation-guide",
    name: "SLO Implementation Guide",
    url: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/observability-monitoring-slo-implement/SKILL.md",
    keywords: ["reliab", "slo", "error budget", "fault tolerance", "uptime"],
    why: "Implementing reliability standards and error-budget practice — fits 'production reliability / error budgets'.",
  },
  {
    id: "web-security-testing",
    name: "Web Security Testing Workflow",
    url: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/web-security-testing/SKILL.md",
    keywords: ["auth", "login", "session", "owasp", "password", "token", "secure"],
    why: "OWASP Top 10 workflow incl. broken authentication — fits 'authentication reliability' and session edge cases.",
  },
  {
    id: "api-security-best-practices",
    name: "API Security Best Practices",
    url: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/api-security-best-practices/SKILL.md",
    keywords: ["authentication", "authorization", "rate limit", "api hardening", "oauth"],
    why: "Authentication, authorization, input validation, rate limiting for APIs.",
  },
  {
    id: "security-audit-hardening",
    name: "007 — Security Audit & Hardening",
    url: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/007/SKILL.md",
    keywords: ["audit", "assessment", "hardening", "threat", "scan", "revive", "positioning"],
    why: "Security audit, hardening, and threat modeling — fits 'assessment / live scan' tasks for unassessed workspaces.",
  },
  {
    id: "competitive-platform-analysis",
    name: "Competitive Platform Analysis",
    url: "https://raw.githubusercontent.com/affaan-m/everything-claude-code/main/skills/competitive-platform-analysis/SKILL.md",
    keywords: ["competitive", "market gap", "customer", "positioning", "benchmark", "validation"],
    why: "Benchmarking and positioning analysis — fits customer-validation and GTM work.",
  },
  {
    id: "developer-signup-flow",
    name: "Developer Signup Flow",
    url: "https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/developer-signup-flow/SKILL.md",
    keywords: ["billing", "onboard", "signup", "sign-up", "checkout", "pricing"],
    why: "Frictionless signup/onboarding flow design — fits 'billing / onboarding' blockers.",
  },
];

export const SKILLS_NOTE =
  "Optional skill recommendations — curated examples from the public " +
  "antigravityskills.directory index; verify the linked SKILL.md before installing. " +
  "They are never required to execute the directive.";

/**
 * Heuristic keyword match over the work text (title + blocker titles). Returns
 * at most 3 distinct, relevant skills, or [] when nothing matches. Pure and
 * deterministic — the same text always yields the same recommendation set.
 */
export function recommendSkillsFor(text: string | null | undefined): SkillRef[] {
  if (!text) return [];
  const hay = text.toLowerCase();
  const hits: SkillEntry[] = [];
  for (const entry of SKILL_CATALOG) {
    if (entry.keywords.some((k) => hay.includes(k))) hits.push(entry);
  }
  const seen = new Set<string>();
  const out: SkillRef[] = [];
  for (const h of hits) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    out.push({ id: h.id, name: h.name, url: h.url, why: h.why });
    if (out.length >= 3) break;
  }
  return out;
}