// Ailhat — Agent Direct GUIDED ONBOARDING
//
// A short, dismissible walkthrough that takes a first-time authenticated owner
// through ONE complete operating pass on the /control view:
//   scan → understand → prioritize → direct
// Each step is tied to the ACTUAL top workspace (the "do this next" leader), so
// the owner sees end-to-end value in a single session without leaving the view.
//
// Account-scoped: only rendered for an authenticated owner (never on the
// anonymous demo). Progress is remembered per-browser via localStorage so it does
// not nag on every visit; no server storage or schema change is introduced.
//
// No Date.now() determinism concerns here — this is presentational only and does
// not touch the directive compiler.

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { ModeledWorkspace } from "~/lib/control-scoring";
import { ONBOARDING_LOOP } from "~/lib/playbook";

const STORAGE_KEY = "ailhat.onboarding.complete";

interface Step {
  key: string;
  label: string;
  title: string;
  body: string;
  /** Inline tie-in to the actual workspace, shown on the step. */
  onScreen: (topName: string) => string;
}

const STEPS: Step[] = [
  {
    ...ONBOARDING_LOOP[0],
    onScreen: () =>
      "Look for the 'Evidence · last scan' line on each card. Live scans and capacity observations are the freshness that makes everything below trustworthy.",
  },
  {
    ...ONBOARDING_LOOP[1],
    onScreen: (topName) =>
      `Read ${topName}'s readiness %, its confidence, and the evidence-basis label. NEEDS ASSESSMENT means 'scan this' — never a failing grade.`,
  },
  {
    ...ONBOARDING_LOOP[2],
    onScreen: (topName) =>
      `The 'Do this next' callout is the highest-leverage move. It's ranked by launch impact × customer value × urgency × availability — leading for ${topName}.`,
  },
  {
    ...ONBOARDING_LOOP[3],
    onScreen: () =>
      "Compile the top work item into an injectable artifact (markdown / JSON / tool-schema / TOON) — copy it and load it into the target workspace to execute.",
  },
];

export default function GuidedOnboarding({ top }: { top: ModeledWorkspace | null }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // SSR-safe: only read the flag after mount in the browser.
  useEffect(() => {
    let done = false;
    try {
      done = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      done = false;
    }
    // Show the walkthrough on first authenticated visit (fresh owner).
    if (!done && top) {
      setOpen(true);
    }
  }, [top]);

  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* non-fatal: just won't persist the dismissal */
    }
    setOpen(false);
  };

  if (!open || !top) return null;

  const s = STEPS[step];
  const topName = top.ws.name;

  return (
    <section className="relative overflow-hidden rounded-xl border border-[#7fb0ff]/30 bg-gradient-to-br from-[#7fb0ff]/[0.10] to-transparent p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="silhat-eyebrow">Guided onboarding · one operating pass</div>
        <button
          type="button"
          onClick={finish}
          className="text-xs font-semibold text-gray-500 transition hover:text-gray-300"
        >
          Dismiss ✕
        </button>
      </div>

      {/* Step progress */}
      <div className="mt-3 flex items-center gap-1.5">
        {STEPS.map((st, i) => (
          <button
            key={st.key}
            type="button"
            onClick={() => setStep(i)}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i === step ? "bg-[#7fb0ff]" : i < step ? "bg-[#7fb0ff]/40" : "bg-gray-700"
            }`}
            aria-label={st.label}
          />
        ))}
      </div>

      <div className="mt-3 grid items-start gap-4 md:grid-cols-[auto_1fr]">
        <span className="hidden h-10 w-10 place-items-center rounded-lg bg-[#7fb0ff]/15 font-mono text-sm font-bold text-[#7fb0ff] md:grid">
          {step + 1}
        </span>
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
            step {s.label}
          </div>
          <h3 className="mt-0.5 text-lg font-semibold text-gray-50">{s.title}</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">{s.body}</p>
          <div className="mt-2 rounded-lg border border-[#7fb0ff]/15 bg-[#7fb0ff]/[0.04] px-3 py-2 text-sm text-gray-300">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
              on this view ·
            </span>{" "}
            {s.onScreen(topName)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
          step {step + 1} of {STEPS.length}
        </span>
        <div className="flex items-center gap-2">
          <Link
            to="/learn"
            className="inline-flex items-center rounded-lg border border-gray-700 bg-gray-800/70 px-3 py-1.5 text-xs font-semibold text-gray-200 hover:bg-gray-800"
          >
            Open the Playbook
          </Link>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((v) => v + 1)}
              className="silhat-btn silhat-btn-primary inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Next step
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="silhat-btn silhat-btn-primary inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold"
            >
              Start — compile a directive →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
