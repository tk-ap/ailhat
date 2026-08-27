import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AuthProvider, useAuth } from "~/lib/useAuth";
import { StoreProvider } from "~/lib/useStore";
import AppShell from "~/components/AppShell";
import {
  PLAYBOOK_LESSONS,
  ONBOARDING_LOOP,
  SKILL_DEMO_NOTE,
  DIRECTORY_NOTE,
  type Lesson,
} from "~/lib/playbook";
import { recommendSkillsFor } from "~/lib/directiveSkills";
import type { SkillRef } from "~/lib/directiveSkills";
import { getAgentControl } from "~/lib/control-query";
import { buildWorkItem, compileDirectives } from "~/lib/directives";
import type { CompiledDirectives, WorkItem } from "~/lib/directives";

export const Route = createFileRoute("/learn")({
  loader: async () => getAgentControl(),
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="learn">
          <Learn />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

/* ---------- shared bits ---------- */

type TabId = "markdown" | "json" | "tools" | "toon";
const TABS: { id: TabId; label: string; mime: string; ext: string }[] = [
  { id: "markdown", label: "Markdown brief", mime: "text/markdown", ext: "md" },
  { id: "json", label: "JSON payload", mime: "application/json", ext: "json" },
  { id: "tools", label: "Tool schema", mime: "application/json", ext: "tool.json" },
  { id: "toon", label: "TOON directive", mime: "text/plain", ext: "toon.txt" },
];

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

function downloadExample(baseName: string, tab: TabId, text: string) {
  const meta = TABS.find((t) => t.id === tab);
  if (!meta) return;
  const blob = new Blob([text], { type: meta.mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.${meta.ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="silhat-eyebrow">{children}</div>
  );
}

/* ---------- worked directive example viewer ---------- */

function WorkedExampleCard({
  exampleId,
  title,
  scenario,
  item,
  compiled,
  skills,
  variant = "sample",
  rankLabel,
}: {
  exampleId: string;
  title: string;
  scenario: string;
  item: WorkItem;
  compiled: CompiledDirectives;
  skills: SkillRef[];
  variant?: "sample" | "account";
  /** Optional rank label for non-top account items (e.g. "#2"). */
  rankLabel?: string;
}) {
  const isAccount = variant === "account";
  const [tab, setTab] = useState<TabId>("markdown");
  const [copied, setCopied] = useState(false);
  const text = compiled[tab];

  const onCopy = async () => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const basisLabel =
    item.evidenceBasis === "computed-live"
      ? "computed · live"
      : item.evidenceBasis === "anchored-seed"
        ? "anchored · seed baseline"
        : "unassessed";

  return (
    <section
      className={
        isAccount
          ? "rounded-xl border border-emerald-400/30 bg-gray-950/70 p-4"
          : "rounded-xl border border-[#7fb0ff]/20 bg-gray-950/70 p-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Eyebrow>
            {isAccount
              ? rankLabel
                ? `Your portfolio · ${rankLabel}`
                : "Your portfolio · do this next"
              : "Worked example"}
          </Eyebrow>
          <h3 className="mt-0.5 text-sm font-semibold text-gray-100">{title}</h3>
          <p className="mt-1 max-w-2xl text-xs text-gray-500">{scenario}</p>
        </div>
        <Chip className="bg-[#7fb0ff]/10 text-[#7fb0ff] ring-[#7fb0ff]/30">{item.workspace.name}</Chip>
      </div>
      {isAccount && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip className="bg-emerald-500/10 text-emerald-300 ring-emerald-500/30">
            from your live portfolio · account-scoped
          </Chip>
          <span className="text-[11px] text-gray-500">
            Compiled from your top-ranked workspace — your real data, not a template.
          </span>
        </div>
      )}

      {/* Honest capacity framing — always visible, never buried. */}
      <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-xs text-amber-100/90">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          capacity context — disclosed, not a promise
        </span>
        <p className="mt-1">{item.capacity.framing}</p>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              tab === t.id
                ? "bg-[#7fb0ff]/15 text-[#7fb0ff] ring-1 ring-inset ring-[#7fb0ff]/30"
                : "bg-gray-800/70 text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <pre className="silhat-terminal mt-2 max-h-80 overflow-auto whitespace-pre-wrap p-3 text-xs leading-relaxed">
        {text}
      </pre>

      {/* Provenance + evidence basis */}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
        <Chip className="bg-amber-500/10 text-amber-300 ring-amber-500/30">evidence · {basisLabel}</Chip>
        <span>Source: {item.source.label} · ID: {item.id}</span>
      </div>

      {/* Skill-recommendation block (optional) */}
      {skills.length > 0 && (
        <div className="mt-2 rounded-lg border border-gray-800 bg-gray-900/60 p-2.5 text-xs">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
            optional skills to install
          </span>
          <ul className="mt-1 space-y-1 text-gray-400">
            {skills.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-[#7fb0ff] hover:underline">
                  {s.name}
                </a>{" "}
                — {s.why}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void onCopy()}
          className="silhat-btn silhat-btn-primary inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <button
          type="button"
          onClick={() => downloadExample(isAccount ? `directive-${item.id}` : `worked-example-${exampleId}`, tab, text)}
          className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-800"
        >
          Download .{TABS.find((t) => t.id === tab)?.ext}
        </button>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-gray-600">
          copy / export — load into your target harness
        </span>
      </div>
    </section>
  );
}

/* ---------- lesson card ---------- */

function LessonCard({ lesson }: { lesson: Lesson }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="silhat-panel flex flex-col p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7fb0ff]">
          {lesson.num}
        </span>
        <Chip className="bg-gray-700/40 text-gray-300 ring-gray-600/40">{lesson.tag}</Chip>
      </div>
      <h3 className="mt-2 text-base font-semibold text-gray-50">{lesson.title}</h3>
      <p className="mt-1 text-sm text-gray-400">{lesson.summary}</p>
      <div className="mt-auto pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-semibold text-[#7fb0ff] hover:underline"
        >
          {open ? "Hide lesson" : "Read lesson"}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2 border-t border-gray-800 pt-3">
          <ul className="space-y-1.5">
            {lesson.points.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="mt-0.5 text-[#7fb0ff]">›</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          {lesson.links && (
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-2.5 text-xs">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
                directory links
              </span>
              <ul className="mt-1 space-y-1 text-gray-400">
                {lesson.links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noreferrer" className="font-medium text-[#7fb0ff] hover:underline">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[10px] text-gray-600">We link — we never bundle third-party skill content.</p>
            </div>
          )}
          {lesson.tip && (
            <div className="rounded-lg border border-[#7fb0ff]/15 bg-[#7fb0ff]/[0.04] px-3 py-2 text-xs text-gray-300">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">Tip</span>
              <p className="mt-0.5">{lesson.tip}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* ---------- skill demo picker ---------- */

interface SkillDemoTask {
  id: string;
  task: string;
  scenario: string;
}

function SkillDemo({ tasks }: { tasks: SkillDemoTask[] }) {
  const [selected, setSelected] = useState<SkillDemoTask>(tasks[0]);
  const skills = recommendSkillsFor(selected.task);

  return (
    <section className="silhat-panel p-5">
      <Eyebrow>Skill selection · live demo</Eyebrow>
      <h2 className="mt-1 text-sm font-semibold text-gray-100">
        Pick a task from your portfolio — see which agent skill we'd recommend
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-400">
        Each option is one of your real top actions (the same work the directive
        compiler above turns into an injectable artifact). Run the deterministic
        keyword heuristic (the same one the compiler uses) to surface a curated
        example skill from{" "}
        <a href="https://antigravityskills.directory" target="_blank" rel="noreferrer" className="text-[#7fb0ff] hover:underline">
          antigravityskills.directory
        </a>
        . Recommendations are optional, never required, and always link to the
        public SKILL.md.
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t)}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              selected.id === t.id
                ? "bg-[#7fb0ff]/15 text-[#7fb0ff] ring-1 ring-inset ring-[#7fb0ff]/30"
                : "bg-gray-800/70 text-gray-400 hover:text-gray-200"
            }`}
          >
            {t.scenario}
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          your real top action
        </div>
        <p className="mt-1 text-sm text-gray-200">{selected.task}</p>

        <div className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
          recommended skills{skills.length === 0 ? " · none matched" : ""}
        </div>
        {skills.length > 0 ? (
          <ul className="mt-1 space-y-1.5 text-sm text-gray-300">
            {skills.map((s) => (
              <li key={s.id} className="flex items-start gap-2">
                <span className="mt-0.5 text-[#7fb0ff]">›</span>
                <span>
                  <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-[#7fb0ff] hover:underline">
                    {s.name}
                  </a>{" "}
                  — {s.why}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-500">
            No curated example matched this task's keywords — the directive still compiles fine. A
            skill is always optional.
          </p>
        )}
      </div>

      <p className="mt-2 text-[10px] text-gray-600">{SKILL_DEMO_NOTE}</p>
      <p className="mt-1 text-[10px] text-gray-600">{DIRECTORY_NOTE}</p>
    </section>
  );
}

/* ---------- page ---------- */

function LoginRequired() {
  return (
    <div className="mx-auto max-w-md silhat-panel border-dashed px-6 py-16 text-center">
      <Eyebrow>Playbook · Learn</Eyebrow>
      <h1 className="mt-2 text-xl font-bold tracking-tight text-gray-50">
        Log in to open the Playbook
      </h1>
      <p className="mt-2 text-sm text-gray-400">
        Scenario lessons, worked directive examples, and skill-selection guidance are account-scoped
        — they build on your own portfolio. Sign in to access them.
      </p>
      <Link
        to="/login"
        className="silhat-btn silhat-btn-primary mt-6 inline-flex items-center rounded-xl px-5 py-2.5"
      >
        Log in
      </Link>
    </div>
  );
}

function LoopStrip() {
  return (
    <section className="silhat-panel p-5">
      <Eyebrow>The operating loop · one pass</Eyebrow>
      <h2 className="mt-1 text-sm font-semibold text-gray-100">
        Scan → Understand → Prioritize → Direct
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-400">
        Every session should move through more of the loop. Work the guided walkthrough on the{" "}
        <Link to="/control" className="text-[#7fb0ff] hover:underline">Direct</Link> view, then come
        back here to internalize the concepts.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ONBOARDING_LOOP.map((s) => (
          <div key={s.key} className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
              {s.label}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-200">{s.title}</div>
            <p className="mt-1 text-xs text-gray-500">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Learn() {
  const { user, loading } = useAuth();
  const control = Route.useLoaderData();
  // ACCOUNT-SCOPED: compile a directive artifact for EVERY real workspace in the
  // owner's portfolio. The loader returns real data only to an authenticated
  // session; anonymous NEVER receives account data (it returns the clearly
  // labeled demo portfolio, which we ignore) and the `user` auth gate below
  // additionally guards this from ever rendering to a visitor.
  const authenticated = !!user && !!control?.authenticated;
  const accountPortfolio = authenticated ? control.portfolio : [];
  const modeledAt = control?.modeledAt ?? 0;

  // Full real-portfolio worked directives — the deterministic compiler with
  // honest capacity framing, provenance/evidence chips, and optional real skill
  // recommendations, run over the owner's actual workspaces (never samples).
  const workedItems = useMemo(
    () =>
      accountPortfolio.map((m) => {
        const item = buildWorkItem(m, modeledAt, { bucket: control?.bucket ?? null });
        return {
          m,
          item,
          compiled: compileDirectives(item),
          skills: recommendSkillsFor(`${item.title} ${m.blockers.map((b) => b.title).join(" ")}`),
        };
      }),
    [accountPortfolio, modeledAt, control?.bucket],
  );
  const top = workedItems[0];

  // Skill-selection demo re-pointed at the owner's REAL top actions — so no fake
  // sample products ever appear on the logged-in page.
  const skillTasks = useMemo(
    () =>
      accountPortfolio.map((m) => ({
        id: `skill-task-${m.ws.id}`,
        scenario: `${m.ws.name}`,
        task:
          m.nextActions[0]?.title ??
          m.blockers[0]?.title ??
          `${m.ws.name}: assess current state before scheduling work`,
      })),
    [accountPortfolio],
  );
  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-gray-400">Loading…</div>
    );
  }

  // Account-scoped: education content is never served to anonymous visitors.
  if (!user) {
    return <LoginRequired />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Playbook · Learn</Eyebrow>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
            The skills of running an agent workforce
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Scenario-driven lessons, worked directives from your own portfolio, and
            skill-selection guidance — tuned to your live portfolio, retained in-app.
          </p>
        </div>
        <div className="text-right font-mono text-[11px] uppercase tracking-wider text-gray-500">
          <div>{PLAYBOOK_LESSONS.length} lessons</div>
          <div>{workedItems.length} worked directives</div>
        </div>
      </div>

      {/* Guided loop overview */}
      <LoopStrip />

      {/* ACCOUNT-LEVEL panel — the owner's real top work, directable now. Renders
          ONLY for an authenticated owner; never for anonymous visitors. */}
      {authenticated && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>Your portfolio — direct it now</Eyebrow>
              <h2 className="mt-1 text-lg font-bold tracking-tight text-gray-50">
                Do this next, on your real work
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-gray-400">
                Your highest-ranked workspace, compiled by the real Agent Direct directive compiler
                into an injectable artifact — copyable in all four formats. This is your own
                account-scoped data, never a template.
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray-600">
              from your live portfolio · account-scoped
            </span>
          </div>
          {top ? (
            <WorkedExampleCard
              variant="account"
              exampleId={top.m.ws.id}
              title={top.item.title}
              scenario={`${top.m.ws.name} · ${top.m.ws.stage}. Ranked first on launch impact — this is the highest-value launch blocker in your portfolio right now.`}
              item={top.item}
              compiled={top.compiled}
              skills={top.skills}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-800 bg-gray-950/60 px-5 py-8 text-center">
              <div className="silhat-eyebrow">Your portfolio · direct it now</div>
              <h3 className="mt-1 text-sm font-semibold text-gray-200">Nothing to direct yet</h3>
              <p className="mx-auto mt-1 max-w-xl text-xs text-gray-500">
                Your portfolio is empty — no modeled work item is available to compile. Run a scan on
                the <Link to="/control" className="text-[#7fb0ff] hover:underline">Direct</Link> view
                to seed evidence, then a directive will appear here.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Your portfolio — worked directives (owner's REAL workspaces; never a
          demo/sample portfolio for an authenticated owner). */}
      {authenticated && workedItems.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Eyebrow>Your portfolio — worked directives</Eyebrow>
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray-600">
              from your live portfolio · account-scoped
            </span>
          </div>
          <p className="mb-3 max-w-3xl text-sm text-gray-400">
            Every real workspace in your portfolio, compiled by the live Agent Direct compiler into
            an injectable artifact — copy or download any of them and load it into the target
            harness. Same structure, provenance stamps, and honest capacity framing as your top
            item; this is your own data, never a template.
          </p>
          <div className="space-y-4">
            {workedItems.map((w, i) => (
              <WorkedExampleCard
                key={w.m.ws.id}
                variant="account"
                rankLabel={i === 0 ? undefined : `#${i + 1}`}
                exampleId={w.m.ws.id}
                title={w.item.title}
                scenario={`${w.m.ws.name} · ${w.m.ws.stage}${w.m.ws.url ? ` · ${w.m.ws.url}` : ""}. ${w.m.distanceLabel}.`}
                item={w.item}
                compiled={w.compiled}
                skills={w.skills}
              />
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 px-4 py-2 text-xs text-gray-500">
            Directives compile deterministically — the same workspace always produces identical
            bytes — and availability is always disclosed context, never a promised slot.
          </p>
        </section>
      )}

      {/* Skill selection, live — demonstrated on your real top actions only. */}
      {authenticated && skillTasks.length > 0 && <SkillDemo tasks={skillTasks} />}

      {/* Playbook lessons */}
      <section>
        <Eyebrow>Playbook · scenario lessons</Eyebrow>
        <h2 className="mt-1 text-sm font-semibold text-gray-100">
          Short, scenario-driven lessons for when it matters
        </h2>
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          {PLAYBOOK_LESSONS.map((l) => (
            <LessonCard key={l.id} lesson={l} />
          ))}
        </div>
      </section>

      <p className="pb-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-gray-600">
        Playbook · Learn — account-scoped · owned by ailhat · never served to anonymous visitors
      </p>
    </div>
  );
}

export default Learn;
