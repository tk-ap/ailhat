// Ailhat — Agent Direct "Legend & how to read" education layer.
//
// UI/education only. This component explains the jargon and visuals on the
// /control view so a new user can interpret readiness metrics, the capacity
// matrix, and the build-space acronyms. It adds no scoring logic and reads no
// data — it is a static explainer map of what is actually on the screen.
//
// Style matches the command-center skin: gray-950 canvas, Space Grotesk display,
// JetBrains Mono uppercase eyebrows, #7fb0ff accent, tight radii.

/* ---------- small building blocks ---------- */

// A definition row: a mono term on the left, plain-English explanation beside it.
function Def({
  term,
  hint,
  children,
}: {
  term: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-800/80 py-3 last:border-0 sm:flex-row sm:gap-4">
      <div className="w-52 shrink-0">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7fb0ff]">
          {term}
        </span>
        {hint && (
          <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-gray-600">
            {hint}
          </div>
        )}
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-gray-400">{children}</p>
    </div>
  );
}

// Small color/label swatch used to map visuals to meaning.
function Swatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-800 bg-gray-950/60 px-2 py-1">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-300">
        {label}
      </span>
    </span>
  );
}

/* ---------- section wrappers ---------- */

function LegendSection({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4">
      <div className="silhat-eyebrow">{eyebrow}</div>
      <h2 className="mt-1 text-sm font-semibold text-gray-100">{title}</h2>
      <p className="mt-1 text-xs text-gray-500">
        Maps 1:1 to the labels, bars, dots and chips rendered on this page.
      </p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/* ---------- the panel ---------- */

export default function ControlLegend() {
  return (
    <section className="silhat-panel overflow-hidden">
      {/* Toggle header — always visible, clearly discoverable */}
      <details className="group" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-gray-800 bg-gray-950/40 px-5 py-4 select-none [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="silhat-eyebrow">Legend &amp; how to read</span>
            <span className="rounded border border-[#7fb0ff]/30 bg-[#7fb0ff]/[0.06] px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
              new user? start here
            </span>
          </div>
          <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-gray-500">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
            <svg
              className="size-4 transition-transform group-open:rotate-180"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 8l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </summary>

        {/* 1. Chart / metric legend */}
        <LegendSection
          eyebrow="01 · chart & metric legend"
          title="What the numbers, bars and dots on this screen mean"
        >
          <Def term="Readiness %" hint="launch readiness">
            A <strong className="text-gray-200">directional</strong> score (0–100) of how far a
            project is from being ready to launch, rolled up from its readiness dimensions
            (Product, Infrastructure, Auth, Intelligence, UX, Billing, GTM). It is an estimate
            grounded in current evidence,{" "}
            <strong className="text-gray-200">never a guaranteed number</strong>. If a project
            hasn't been assessed yet it shows <em className="text-gray-300">NEEDS ASSESSMENT</em> —
            a score is never invented without evidence.
          </Def>
          <Def term="Confidence" hint="high / medium / low">
            How much you should <strong className="text-gray-200">trust the readiness figure</strong>{" "}
            given how fresh the evidence is. Staleness reduces it: the longer since the last scan
            or observation, the more the evidence may be out of date, so confidence drops.
          </Def>
          <Def term="First paid client distance" hint="sessions / weeks">
            An <strong className="text-gray-200">approximate</strong> distance — expressed in work
            sessions or weeks — to a credible first-customer-ready state. It's a planning estimate
            to focus effort, <strong className="text-gray-200">never a guarantee</strong> of when
            revenue actually lands.
          </Def>
          <Def term="Launch impact vs customer impact" hint="two bars per card">
            Two 0–100 bars: <em className="text-gray-300">Launch impact</em> is how much completing
            this work moves the project toward launch (reaching a credible first-customer-ready
            state); <em className="text-gray-300">Customer impact</em> is how much it moves the
            needle for the customer. Where an exact number can't be justified they show as
            qualitative HIGH / MEDIUM / LOW instead of a fabricated score.
          </Def>
          <Def term="Estimated effort" hint="work sessions">
            How many agent work sessions the recommended step is expected to take.
          </Def>
          <Def term="Capacity window" hint="recommended agent">
            The <strong className="text-gray-200">when</strong>: the time slot when an agent is
            actually free, paired with the <strong className="text-gray-200">recommended agent /
            provider</strong> (the role and harness best placed to take the work).
          </Def>
          <Def term="Capacity by project × interface" hint="CLI · Web UI · API · Sandbox">
            The matrix shows whether an <strong className="text-gray-200">agent is free right
            now</strong>, per project and per interface (the surface an agent works through). Cells
            read:{" "}
            <span className="inline-flex flex-wrap items-center gap-1.5 align-middle px-1">
              <Swatch className="bg-emerald-400" label="Available" />
              <Swatch className="bg-amber-400" label="Busy" />
              <Swatch className="bg-gray-600" label="No agent" />
            </span>
            . The flag <Swatch className="bg-[#7fb0ff]" label="work needed here" /> marks a free
            interface that has an actionable blocker sitting on it — a place work can start now.
          </Def>
          <Def term="Shared cto.new Builder bucket" hint="shared capacity across products">
            Products that draw on one shared{" "}
            <strong className="text-gray-200">cto.new Builder</strong> pool. Working on either one
            depletes the capacity available to the other — so their windows must never overlap.
            Reserve a window for one at a time.
          </Def>
        </LegendSection>

        {/* 2. Education — build-space terms */}
        <LegendSection
          eyebrow="02 · education"
          title="Build-space terms, in plain English"
        >
          <Def term="Harness / interface" hint="CLI · Web UI · API · Sandbox">
            The <strong className="text-gray-200">surface an agent works through</strong>. A CLI for
            terminal-driven work, a Web UI for browser-driven work, an API for programmatic
            integration, a Sandbox for isolated runs. The matrix tracks availability on each of
            these per project.
          </Def>
          <Def term="Agent capacity / availability" hint="available · busy · no agent">
            Whether an <strong className="text-gray-200">agent is free to do work right now</strong>.
            "Available" means it can take a task immediately; "Busy" means it's already engaged;
            "No agent" means none is set up on that interface for that project.
          </Def>
          <Def term="Readiness" hint="launch readiness">
            How far a project is from launch — the umbrella metric this view scores and tracks over
            time as evidence refreshes.
          </Def>
          <Def term="Confidence" hint="evidence freshness">
            How much to trust the readiness figure, driven by how recent and complete the evidence
            is. Older scans mean lower confidence.
          </Def>
          <Def term="GTM" hint="go-to-market">
            The readiness dimension covering <strong className="text-gray-200">customer validation and
            marketing</strong> — how well the project can actually reach and convert a first customer,
            not just ship software.
          </Def>
          <Def term="First paid client" hint="revenue distance">
            How far from real revenue — the milestone all prioritization is pointed at. The "Do this
            next" leader is whatever moves a project closest to landing that first paid client.
          </Def>
          <Def term="Blockers" hint="primary blockers · risks">
            The specific things <strong className="text-gray-200">stopping launch</strong> for a
            project, each tagged by severity (high / medium / low). An interface with "work needed
            here" is one that can act on a blocker right now.
          </Def>
          <Def term="NEEDS ASSESSMENT" hint="unassessed workspace">
            A project without enough evidence to score. It shows a placeholder instead of a
            percentage — a readiness number is <strong className="text-gray-200">never fabricated</strong>{" "}
            until a scan/assessment provides evidence.
          </Def>
          <Def term="ACT NOW / REVIEW / OPPORTUNITY / HEALTHY" hint="attention state">
            The attention badges on each card tell you what needs a human:{" "}
            <em className="text-gray-300">ACT NOW</em> (highest-priority next step),{" "}
            <em className="text-gray-300">REVIEW</em> (needs a look),{" "}
            <em className="text-gray-300">OPPORTUNITY</em> (worth pursuing),{" "}
            <em className="text-gray-300">HEALTHY</em> (no action needed).
          </Def>
          <Def term="The operating loop" hint="scan → prioritize → recommend → execute → rescan">
            How this view decides what to do:{" "}
            <strong className="text-gray-200">
              scan the workspace → understand state → identify gaps → prioritize work → monitor agent
              capacity → recommend the right agent and window → execute → rescan
            </strong>{" "}
            and update readiness. Every session should move through more of this loop.
          </Def>
        </LegendSection>
      </details>
    </section>
  );
}
