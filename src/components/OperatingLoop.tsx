import { Link } from "@tanstack/react-router";

const STEPS = [
  { label: "Scan", detail: "Observe current product state", to: "/dashboard" as const },
  { label: "Review", detail: "Rank what changed and why it matters", to: "/brief" as const },
  { label: "Prepare", detail: "Turn intelligence into agent-ready work", to: "/control" as const },
  { label: "Execute", detail: "Give direction to the chosen harness", to: "/control" as const },
  { label: "Re-scan", detail: "Verify the outcome with fresh evidence", to: "/dashboard" as const },
] as const;

function LoopRun({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 pr-8"
      aria-hidden={duplicate ? true : undefined}
    >
      <span className="mr-1 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-600">
        operating loop
      </span>
      {STEPS.map((step, index) => (
        <div key={`${step.label}-${index}`} className="flex shrink-0 items-center gap-2">
          <Link
            to={step.to}
            title={step.detail}
            tabIndex={duplicate ? -1 : undefined}
            className="group flex items-center gap-1.5 rounded-md border border-gray-800 bg-gray-900/70 px-2 py-1 text-[10px] font-semibold text-gray-400 transition hover:border-[#7fb0ff]/40 hover:text-gray-100"
          >
            <span className="font-mono text-[9px] text-[#7fb0ff]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{step.label}</span>
          </Link>
          {index < STEPS.length - 1 && (
            <span className="text-[10px] text-gray-700">→</span>
          )}
        </div>
      ))}
      <span className="ml-1 shrink-0 text-[10px] text-gray-600">
        fresh evidence closes the loop
      </span>
      <span className="ml-2 shrink-0 text-[10px] text-gray-800">◆</span>
    </div>
  );
}

export default function OperatingLoop({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="ailhat operating loop"
      className={`border-b border-gray-800 bg-gray-950/80 ${compact ? "py-2" : "py-2.5"}`}
    >
      <div className="marquee w-full">
        <div className="marquee-track items-center">
          <LoopRun />
          <LoopRun duplicate />
        </div>
      </div>
    </section>
  );
}
