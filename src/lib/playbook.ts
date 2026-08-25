// Ailhat — Agent Direct EDUCATION / ACTIVATION content (the Playbook & Learn).
//
// PURE, static, SSR-safe content. No scoring, no data reads — this module just
// holds the library of scenario-driven lessons, the skill-selection guidance,
// and the sample-task → skill-recommendation demos that the /learn route renders.
//
// It extends the Legend vocabulary already shipped on /control; it deliberately
// does NOT duplicate the Legend's plain-English glossary (that stays a collapsed
// secondary disclosure). The higher-value, proprietary concepts live here in-app
// and are account-scoped (rendered only for the authenticated owner).
//
// Honesty discipline is preserved: lessons never instruct fabricating readiness
// deltas, capacity windows, or availability promises. Skill recommendations are
// curated example links (we link to SKILL.md, we never bundle third-party content).

export interface PlaybookLink {
  label: string;
  url: string;
}

export interface Lesson {
  id: string;
  num: string;
  tag: string;
  title: string;
  summary: string;
  points: string[];
  /** Optional curated links (we link — we never copy third-party skill content). */
  links?: PlaybookLink[];
  tip?: string;
}

export const DIRECTORY_URL = "https://antigravityskills.directory";
export const DIRECTORY_FEED_URL = "https://antigravityskills.directory/feed.xml";
export const DIRECTORY_INDEX_URL = "https://antigravityskills.directory/llms.txt";

export const DIRECTORY_NOTE =
  "antigravityskills.directory indexes 3,335+ agentic skills (Claude, Cursor, " +
  "Antigravity and more) straight from public repos, each linking directly to " +
  "its SKILL.md. We link to those public artifacts — we never bundle or copy " +
  "third-party skill content — and each recommendation is a curated example to " +
  "verify before installing.";

export const PLAYBOOK_LESSONS: Lesson[] = [
  {
    id: "readiness-vs-confidence",
    num: "01",
    tag: "read the view",
    title: "Readiness vs confidence — don't over-trust a stale percentage",
    summary:
      "The readiness number is only as good as the evidence behind it. Read the confidence and the evidence-basis label before you act on the figure.",
    points: [
      "A ready % is a directional estimate rolled up from readiness dimensions. It is never a guaranteed number.",
      "The Confidence chip (High / Medium / Low) tells you how fresh that evidence is — older scans and observations drop it. A number without fresh evidence is a stale number.",
      "NEEDS ASSESSMENT is NOT a failing grade. It means 'scan this first' — no percentage is ever invented without evidence, so an unassessed workspace genuinely cannot show one.",
      "Every figure carries an evidence-basis label (computed·live / anchored·seed / unassessed). Provenance on every fact is the whole point.",
      "When readiness and confidence disagree — say a mid score with Low confidence — the honest read is 're-verify before committing work', not 'this is mid'.",
    ],
    tip: "Before you schedule work against a number, check its confidence and evidence-basis. Stale or seeded ⇒ re-verify first.",
  },
  {
    id: "push-vs-wait-capacity",
    num: "02",
    tag: "pick the fight",
    title: "When to push on a blocker vs wait for capacity",
    summary:
      "A blocker you can act on now outranks a bigger one you can't touch until capacity frees. Availability is how 'now' wins.",
    points: [
      "Ranking = launch impact × customer value × urgency × availability. Availability is the multiplier that lets an actionable-now task beat a theoretically larger one.",
      "If the workspace's top interface is Available and shows work flagged, that work can start right now — push it. The matrix tells you exactly which interface can act.",
      "If every interface is Busy or has No agent, the honest move is to wait for a window rather than stall the product manually — the matrix decides 'when'.",
      "Shared bucket: two products drawing on one cto.new Builder cannot both run at once — their windows must never overlap.",
      "A real blocker (High severity) caps how ready a product can claim to be; clearing it is often the fastest lever to a trustworthy move on the needle.",
    ],
    tip: "Let the capacity matrix decide 'when' and the workspace's next-action list decide 'what'.",
  },
  {
    id: "capacity-window-timing",
    num: "03",
    tag: "timing",
    title: "What good capacity-window timing looks like (push vs pause)",
    summary:
      "Great timing is a window you can actually act in now — not a number that looks nice later.",
    points: [
      "Capacity context is a DISCLOSED snapshot (observed %, staleness/freshness), never a promise that an agent is idle or a slot is reserved. Verify in the harness before starting.",
      "Push when the recommended interface is Available with work flagged there; pause when it's Busy / No agent and nothing can start.",
      "Weight 'when' by freshness confidence: a recent observation is more trustworthy than a stale one.",
      "Never book a 'next free window' from this screen — that is a reference label until a live, semantically-defined capacity source supports it.",
    ],
    tip: "If you can't verify capacity in the harness, treat the window as a suggestion, not a reservation.",
  },
  {
    id: "skill-selection",
    num: "04",
    tag: "skills",
    title: "How to pick which agent skill to install for a task",
    summary:
      "The meta-skill that compounds: choose the skill that matches the task's core demand, and install it at the moment of use — not everything up front.",
    points: [
      "A skill is a packaged, reusable way of working (a SKILL.md) that makes an agent competent at a task without re-explaining it each time.",
      "Match the skill to the task's core demand: security-ish work → web-security / OWASP / API-security skills; load & reliability → k6 load-testing / SLO skills; signup, billing & onboarding → developer-signup-flow; positioning & validation → competitive-platform-analysis.",
      "Install it at the moment you start that task (progressive disclosure), not as an up-front pile of every skill you might ever need.",
      "Agent Direct embeds a small, OPTIONAL 'skills to install' block in directive output, curated as examples from antigravityskills.directory — each recommendation links straight to its public SKILL.md.",
      "A recommended skill is additive and never required: it never blocks compiling or running the directive.",
    ],
    links: [
      { label: "antigravityskills.directory", url: DIRECTORY_URL },
      { label: "skill index (llms.txt)", url: DIRECTORY_INDEX_URL },
      { label: "skills feed (feed.xml)", url: DIRECTORY_FEED_URL },
    ],
    tip: "Ask 'what does this task really demand?' — the skill that answers that in one sentence is the one to install.",
  },
  {
    id: "rerun-the-loop",
    num: "05",
    tag: "the loop",
    title: "After you act — re-run the loop so readiness updates from live evidence",
    summary:
      "Completing work is not the end of the loop. Report it and rescan so the evidence refresh actually moves the numbers you can trust.",
    points: [
      "The operating loop: scan → understand → prioritize → direct → execute → rescan → update readiness.",
      "A fresh scan / observation becomes live evidence, which recomputes readiness and confidence (computed·live) and restamps provenance.",
      "Clearing unresolved HIGH blockers is the fastest lever to a readiness figure you can trust — the ceiling they impose lifts when they're gone.",
      "Keep the cadence tight: work in the window, then immediately re-scan so the next 'do this next' reflects what actually changed.",
    ],
    tip: "After every execution, rescan. A loop you don't re-run is just a snapshot you'll outgrow.",
  },
];

// ---- Sample-task → skill recommendation demos (skill-selection lesson) ----
// Each sample task is a stand-in "work item" string; we run it through the same
// deterministic keyword heuristic (recommendSkillsFor) used inside the directive
// compiler so the demo shows genuine behaviour, clearly labeled as examples.

export interface SkillDemoTask {
  id: string;
  task: string;
  scenario: string;
}

export const SKILL_DEMO_TASKS: SkillDemoTask[] = [
  {
    id: "demo-task-auth",
    task: "Harden authentication and session handling for the web app",
    scenario: "security-ish work before launch",
  },
  {
    id: "demo-task-load",
    task: "Add load testing and stress checks ahead of launch traffic",
    scenario: "reliability / capacity hardening",
  },
  {
    id: "demo-task-billing",
    task: "Fix checkout, billing and onboarding signup-flow friction",
    scenario: "revenue-path / conversion work",
  },
  {
    id: "demo-task-positioning",
    task: "Refresh product positioning and customer validation for GTM",
    scenario: "validation / go-to-market work",
  },
];

// Shared note rendered next to every skill recommendation block.
export const SKILL_DEMO_NOTE =
  "Curated example recommendations — verified SKILL.md links at commit time. " +
  "Verify the latest URL before installing. Never required to execute the task.";

// The four-step onboarding framing used by guided onboarding and the Learn index.
export interface LoopStep {
  key: string;
  label: string;
  title: string;
  body: string;
}

export const ONBOARDING_LOOP: LoopStep[] = [
  {
    key: "scan",
    label: "1 · Scan",
    title: "Scan the workspace",
    body: "ailhat observes the workspace and records live evidence (site scans + capacity observations). Fresh evidence is what makes every other step trustworthy.",
  },
  {
    key: "understand",
    label: "2 · Understand",
    title: "Understand current state",
    body: "Read readiness, confidence, and the evidence-basis label. NEEDS ASSESSMENT means 'scan this', never a failing grade.",
  },
  {
    key: "prioritize",
    label: "3 · Prioritize",
    title: "Prioritize the work",
    body: "Everything is ranked by launch impact × customer value × urgency × availability — the highest-leverage next action surfaces on top.",
  },
  {
    key: "direct",
    label: "4 · Direct",
    title: "Compile the directive",
    body: "Convert the top work item into an injectable artifact (markdown / JSON / tool-schema / TOON) ready to load into the target workspace.",
  },
];
