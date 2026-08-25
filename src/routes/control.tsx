import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  StoreProvider,
  useStore,
} from "~/lib/useStore";
import { AuthProvider } from "~/lib/useAuth";
import AppShell from "~/components/AppShell";
import ControlLegend from "~/components/ControlLegend";
import { getAgentControl } from "~/lib/control-query";
import { leaderReason } from "~/lib/control-scoring";
import type { ModeledWorkspace } from "~/lib/control-scoring";
import { HARNESSES, SLOT_LABEL } from "~/lib/agent-control";
import type { SlotState } from "~/lib/agent-control";
import { ageLabelObs, type LiveOverlay } from "~/lib/observations";

export const Route = createFileRoute("/control")({
  loader: async () => getAgentControl(),
  component: () => (
    <AuthProvider>
      <StoreProvider>
        <AppShell active="control">
          <Control />
        </AppShell>
      </StoreProvider>
    </AuthProvider>
  ),
});

/* ---------- tone maps (restrained command-center accents) ---------- */

const portfolioTone: Record<string, string> = {
  ACTIVE: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
  "NEEDS ATTENTION": "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  STALE: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  BLOCKED: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  HEALTHY: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  "NEEDS ASSESSMENT": "bg-gray-700/40 text-gray-300 ring-gray-600/40",
  PAUSED: "bg-gray-700/40 text-gray-400 ring-gray-600/40",
};

const attentionTone: Record<string, string> = {
  "ACT NOW": "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  REVIEW: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  OPPORTUNITY: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  HEALTHY: "bg-gray-700/40 text-gray-400 ring-gray-600/40",
  "NEEDS ASSESSMENT": "bg-gray-700/40 text-gray-300 ring-gray-600/40",
};

const severityTone: Record<string, string> = {
  high: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  medium: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  low: "bg-gray-700/40 text-gray-300 ring-gray-600/40",
};

const slotDot: Record<SlotState, string> = {
  available: "bg-emerald-400",
  busy: "bg-amber-400",
  none: "bg-gray-600",
};

const slotLabel: Record<SlotState, string> = SLOT_LABEL;

const confTone: Record<string, string> = {
  High: "text-emerald-300",
  Medium: "text-amber-300",
  Low: "text-rose-300",
};

function Chip({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function Bar({ value, tone }: { value: number; tone?: string }) {
  const fill = tone ?? "bg-[#7fb0ff]";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
      <div
        className={`h-full rounded-full ${fill}`}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ---------- shared Builder bucket ---------- */

function SharedBucketCallout({ bucket }: { bucket: LiveOverlay | null }) {
  return (
    <section className="silhat-panel p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7fb0ff]">
          Shared capacity
        </span>
        <span className="rounded border border-gray-700 bg-gray-800/70 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-gray-400">
          cto.new builder
        </span>
      </div>
      <h2 className="mt-2 text-sm font-semibold text-gray-100">
        One shared cto.new Builder execution bucket
      </h2>
      <p className="mt-1 max-w-3xl text-sm text-gray-400">
        The shared <strong className="text-gray-200">cto.new Builder</strong> bucket serves the
        products that draw from it: work on one consumer depletes the capacity available to the
        other. They cannot both be worked at once — reserve a window for one at a time.
      </p>
      {bucket ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/70 px-4 py-3 text-sm">
          <span className="font-mono text-xs font-semibold text-[#7fb0ff]">
            {bucket.cap != null ? `${bucket.cap}%` : "not detected"}
          </span>
          <span className="text-gray-400">
            shared Builder availability{" "}
            <span className="italic text-gray-500">
              (observed {bucket.provider ?? "provider"} · {ageLabelObs(Date.now(), bucket.observedAt)} ·{" "}
            </span>
            <span className={confTone[bucket.tier]}>
              {bucket.tier.toLowerCase()} confidence
            </span>
            <span className="italic text-gray-500"> · {bucket.staleness})</span>
          </span>
        </div>
      ) : (
        <p className="mt-3 text-xs font-medium text-gray-500">
          no live observation for cto.new yet — reference baseline only. Sync an authenticated
          cto.new page to see the shared Builder bucket's real availability here.
        </p>
      )}
    </section>
  );
}

/* ---------- capacity matrix ---------- */

function CapacityMatrix({ portfolio }: { portfolio: ModeledWorkspace[] }) {
  const top = portfolio[0];
  const leadInterface =
    top && top.actionableNow.length > 0 ? top.actionableNow[0] : undefined;
  const takeaway = top
    ? leadInterface
      ? `The highest-priority workspace is ${top.ws.name}. ${top.ws.recommendedAgent} is available now on ${leadInterface} and can take its next step right away.`
      : `No interface is currently free to take the next step for ${top.ws.name}.`
    : "";
  return (
    <section className="silhat-panel p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-100">
          Capacity by project × interface
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7fb0ff]/30 bg-[#7fb0ff]/[0.06] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#7fb0ff]">
          <span className="ping-dot ping-dot--blue h-1.5 w-1.5 rounded-full bg-[#7fb0ff]" />
          live
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Is an agent free on this interface for this project right now — and is there work they can take on it?
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="py-2 pr-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                Project
              </th>
              {HARNESSES.map((h) => (
                <th key={h} className="px-2 py-2 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {portfolio.map((m) => {
              const blockerTitle = (id?: string) =>
                id ? m.ws.blockers.find((b) => b.id === id)?.title : undefined;
              return (
                <tr key={m.ws.id} className="border-b border-gray-800 last:border-0">
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="font-medium text-gray-200">{m.ws.name}</div>
                    <div className="text-[11px] text-gray-500">{m.ws.stage}</div>
                    {m.ws.sharedBucket && (
                      <div className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#7fb0ff]">
                        shared {m.ws.sharedBucket} bucket
                      </div>
                    )}
                  </td>
                  {HARNESSES.map((h) => {
                    const slot = m.ws.interfaces[h];
                    const needsWork = slot.state === "available" && !!slot.work;
                    return (
                      <td key={h} className="px-2 py-2.5 text-center align-middle">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-800 bg-gray-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                          <span className={`h-1.5 w-1.5 rounded-full ${slotDot[slot.state]}`} />
                          {slotLabel[slot.state]}
                        </span>
                        {needsWork && (
                          <div
                            className="mt-1 text-[10px] font-medium text-[#7fb0ff]"
                            title={blockerTitle(slot.work)}
                          >
                            work needed here
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-gray-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Available</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Busy</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-gray-600" /> No agent</span>
        <span className="inline-flex items-center gap-1.5 text-[#7fb0ff]">work needed = free interface that can act on a blocker</span>
      </div>
      {takeaway && (
        <p className="mt-4 rounded-lg border border-gray-800 bg-gray-950/70 px-4 py-3 text-sm text-gray-400">
          <span className="font-semibold text-[#7fb0ff]">Takeaway:</span> {takeaway}
        </p>
      )}
    </section>
  );
}

/* ---------- card pieces ---------- */

function StatusBadges({ m }: { m: ModeledWorkspace }) {
  const ws = m.ws;
  const attentionKey =
    ws.attention ?? (ws.readinessPct === null ? "NEEDS ASSESSMENT" : "HEALTHY");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Chip className={portfolioTone[ws.portfolioState]}>{ws.portfolioState}</Chip>
      <Chip className={attentionTone[attentionKey]}>{attentionKey}</Chip>
      {ws.sharedBucket && (
        <Chip className="bg-[#7fb0ff]/10 text-[#7fb0ff] ring-[#7fb0ff]/30">
          shared {ws.sharedBucket}
        </Chip>
      )}
      {m.priorityFactors.neglect >= 0.5 && (
        <Chip className="bg-amber-500/10 text-amber-300 ring-amber-500/30">
          neglected {ws.daysSinceAttention}d
        </Chip>
      )}
    </div>
  );
}

function ReadinessPanel({ m }: { m: ModeledWorkspace }) {
  const live = m.live;
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Launch readiness
        </span>
        {m.readiness != null ? (
          <span className="font-display text-sm font-bold text-[#7fb0ff]">{m.readiness}%</span>
        ) : (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            needs assessment
          </span>
        )}
      </div>
      {m.readiness != null ? (
        <div className="mt-2"><Bar value={m.readiness} /></div>
      ) : (
        <div className="mt-2 rounded-md border border-dashed border-gray-700 px-2 py-1.5 text-[11px] text-gray-500">
          No percentage — run assessment/scan first. A score is never invented without evidence.
        </div>
      )}
      {/* Live observed availability (never invented — baseline shown if none). */}
      <div className="mt-2 rounded-md border border-[#7fb0ff]/15 bg-[#7fb0ff]/[0.04] px-2.5 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-gray-300">
            {live
              ? live.cap != null
                ? `Availability: ${live.cap}%`
                : "Availability: not detected"
              : "Availability: reference baseline"}
          </span>
          {live ? (
            <Chip className={live.tier === "High" ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" : live.tier === "Medium" ? "bg-amber-500/10 text-amber-300 ring-amber-500/30" : "bg-rose-500/10 text-rose-300 ring-rose-500/30"}>
              {live.tier.toLowerCase()} conf · {live.staleness}
            </Chip>
          ) : (
            <Chip className="bg-gray-700/40 text-gray-400 ring-gray-600/40">
              no live observation
            </Chip>
          )}
        </div>
        {live && live.cap != null && (
          <div className="mt-1.5"><Bar value={live.cap} tone="bg-emerald-400" /></div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span className="min-w-0 break-words">{m.distanceLabel}</span>
        {m.confidence && !live && m.readiness != null && (
          <Chip
            className={
              m.evidenceBasis === "computed-live"
                ? m.confidence === "High"
                  ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                  : m.confidence === "Medium"
                    ? "bg-amber-500/10 text-amber-300 ring-amber-500/30"
                    : "bg-rose-500/10 text-rose-300 ring-rose-500/30"
                : "bg-amber-500/10 text-amber-300 ring-amber-500/30"
            }
          >
            {m.confidence} confidence
          </Chip>
        )}
      </div>
      {m.readiness != null && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-gray-800 pt-2">
          <Chip
            className={
              m.evidenceBasis === "computed-live"
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                : "bg-gray-700/40 text-gray-400 ring-gray-600/40"
            }
          >
            {m.evidenceBasis === "computed-live"
              ? "computed · live"
              : "anchored · seed baseline"}
          </Chip>
          <span className="text-[10px] text-gray-600">how this % was derived</span>
        </div>
      )}
    </div>
  );
}

function ImpactPanel({ m }: { m: ModeledWorkspace }) {
  const launch = typeof m.launchImpact === "number" ? m.launchImpact : null;
  const customer = typeof m.customerImpact === "number" ? m.customerImpact : null;
  const label = (v: string | number) =>
    typeof v === "number" ? `${v}/100` : `${v} (qualitative)`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Launch impact
        </span>
        <span className="font-mono text-[11px] font-semibold text-[#7fb0ff]">
          {label(m.launchImpact)}
        </span>
      </div>
      {launch != null && <Bar value={launch} />}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
          Customer impact
        </span>
        <span className="font-mono text-[11px] font-semibold text-emerald-300">
          {label(m.customerImpact)}
        </span>
      </div>
      {customer != null && <Bar value={customer} tone="bg-emerald-400" />}
      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
        <span>Priority rank</span>
        <span className="font-display font-semibold text-gray-200">#{m.priority} pts</span>
      </div>
    </div>
  );
}

function ProductCard({ m, now }: { m: ModeledWorkspace; now: number }) {
  return (
    <article className="silhat-panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-2.5">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7fb0ff]" />
          {m.live ? "live sync" : m.scan ? "live scan" : "reference"}
          <span className="text-gray-600">·</span>
          <span className="text-gray-500">priority #{m.priority} pts</span>
        </div>
        <StatusBadges m={m} />
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              {m.ws.stage}
              {m.ws.url && (
                <a href={m.ws.url} target="_blank" rel="noreferrer" className="ml-1 text-[#7fb0ff] hover:underline">
                  ↗
                </a>
              )}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-gray-50">{m.ws.name}</h2>
            <p className="mt-1 text-sm text-gray-400">{m.ws.summary}</p>
          </div>
        </div>

        {/* Readiness + impact */}
        <div className="grid grid-cols-2 gap-3">
          <ReadinessPanel m={m} />
          <ImpactPanel m={m} />
        </div>

        {/* Readiness dimensions (ailhat) */}
        {m.ws.dimensions && (
          <div>
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
              Readiness dimensions
            </div>
            <div className="space-y-1.5">
              {m.ws.dimensions.map((d) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 text-xs text-gray-400">{d.label}</span>
                  <div className="flex-1"><Bar value={d.value} /></div>
                  <span className="w-8 text-right text-xs font-semibold text-gray-300">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Blockers + risks */}
        <div>
          <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Primary blockers · risks
          </div>
          <ul className="space-y-1">
            {m.blockers.map((b) => (
              <li key={b.id ?? b.title} className="flex items-start justify-between gap-2 text-sm">
                <span className="text-gray-300">{b.title}</span>
                <Chip className={severityTone[b.severity]}>{b.severity}</Chip>
              </li>
            ))}
          </ul>
        </div>

        {/* Next actions */}
        <div>
          <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Next actions
          </div>
          <ol className="space-y-2">
            {m.nextActions.map((a, i) => (
              <li key={a.id} className="flex items-start gap-2 rounded-lg border border-gray-800 bg-gray-950/50 p-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-[#7fb0ff]/15 font-mono text-[10px] font-bold text-[#7fb0ff]">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-200">{a.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-gray-500">
                    <Chip className="bg-gray-700/40 text-gray-300 ring-gray-600/40">{a.role}</Chip>
                    <span>{a.effort}</span>
                    <span>· {a.window}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Allocation footer */}
        <div className="mt-auto grid grid-cols-2 gap-3 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
              Recommended agent
            </div>
            <div className="mt-1 text-sm font-medium text-gray-200">{m.recommendedAgent}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
              Capacity window
            </div>
            <div className="mt-1 text-sm font-medium text-gray-200">{m.recommendedWindow}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
              Estimated effort
            </div>
            <div className="mt-1 text-sm font-medium text-gray-200">{m.estimatedEffort}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
              Evidence · last scan
            </div>
            {m.scan ? (
              <>
                <div className="mt-1 text-sm font-medium text-[#7fb0ff]">
                  live scan · {ageLabelObs(now, m.scan.scannedAt)}
                </div>
                <div className="font-mono text-[10px] text-gray-500">
                  {m.scan.url?.replace(/^https?:\/\//, "")} ·{" "}
                  {m.scan.ok
                    ? `${m.scan.totalFailures} open finding${m.scan.totalFailures === 1 ? "" : "s"} (${m.scan.findings.CRITICAL}C / ${m.scan.findings.HIGH}H / ${m.scan.findings.MEDIUM}M)`
                    : "site unreachable"} · {m.scan.staleness}
                </div>
              </>
            ) : m.live ? (
              <>
                <div className="mt-1 text-sm font-medium text-[#7fb0ff]">
                  live observation · {ageLabelObs(now, m.live.observedAt)}
                </div>
                <div className="font-mono text-[10px] text-gray-500">
                  {m.live.provider} · {m.live.url?.replace(/^https?:\/\//, "")} · observed{" "}
                  {new Date(m.live.observedAt).toISOString().slice(0, 19)}Z · {m.live.staleness}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 text-sm font-medium text-gray-200">{m.evidenceLabel}</div>
                <div className="font-mono text-[10px] text-gray-500">
                  {m.ws.lastScan} · no live evidence — reference baseline
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ---------- page ---------- */

function ControlLoginRequired() {
  return (
    <div className="mx-auto max-w-md silhat-panel border-dashed px-6 py-16 text-center">
      <div className="silhat-eyebrow">Agent Direct</div>
      <h1 className="mt-2 text-xl font-bold tracking-tight text-gray-50">
        Log in to see your portfolio
      </h1>
      <p className="mt-2 text-sm text-gray-400">
        Your Agent Direct workspace — readiness, blockers, and next actions
        across your projects — is private to your account. Sign in to view it.
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

function Control() {
  const { state } = useStore();
  const data = Route.useLoaderData();
  const now = data?.modeledAt ?? Date.now();

  // Account-scoped gate: the portfolio (readiness, blockers, actions, agent
  // capacity) is the owner's private data. Never render it to an unauthenticated
  // client — the loader returns `authenticated: false` and serves the CLEARLY-
  // LABELED sample (demo) portfolio when `demo` is true; otherwise (loader gap)
  // fall back to a "log in to see your portfolio" prompt.
  const demo = !data?.authenticated && !!data?.demo;
  if (!demo && !data?.authenticated) {
    return <ControlLoginRequired />;
  }

  const portfolio = useMemo(() => data?.portfolio ?? [], [data]);
  const top = portfolio[0];
  const sharedNote =
    top && top.ws.sharedBucket
      ? `Note: ${top.ws.name} draws from the shared ${top.ws.sharedBucket} bucket — its window must not overlap the other consumer.`
      : undefined;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      {/* Anonymous demo banner — the sample portfolio is clearly labeled so no one
          mistakes it for their own projects. */}
      {demo && (
        <section className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-950">
              Demo · sample data
            </span>
            <p className="text-sm text-amber-100">
              This is a <strong>fictional demo portfolio</strong> showing how Ailhat ranks
              launch readiness and next actions. It is not your projects.{" "}
              <Link to="/login" className="font-semibold underline underline-offset-2">
                Log in or sign up
              </Link>{" "}
              to see your real portfolio.
            </p>
          </div>
        </section>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="silhat-eyebrow">Agent Direct</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-50">
            What should I do next, and why does it matter for launch?
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Execution capacity &amp; allocation across the portfolio — product state from ailhat,
            capacity context on top.
          </p>
        </div>
        <div className="text-right font-mono text-[11px] uppercase tracking-wider text-gray-500">
          <div>{portfolio.length} workspaces</div>
          <div>ranked · impact × urgency × availability</div>
        </div>
      </div>

      {/* Do-this-next callout */}
      {top && (
        <section className="relative overflow-hidden rounded-xl border border-[#7fb0ff]/25 bg-gradient-to-br from-[#7fb0ff]/[0.08] to-transparent p-5">
          <div className="silhat-eyebrow">Do this next</div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-xl font-bold text-gray-50">{top.ws.name}</span>
            <span className="text-gray-500">—</span>
            <span className="text-lg font-semibold text-gray-200">{top.nextActions[0].title}</span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Reason: <span className="text-gray-200">{leaderReason(top)}</span>. Completing it moves{" "}
            {top.ws.name} closest to landing the first paid client.
          </p>
          {sharedNote && (
            <p className="mt-1.5 text-xs font-medium text-[#7fb0ff]">{sharedNote}</p>
          )}
        </section>
      )}

      <SharedBucketCallout bucket={data?.bucket ?? null} />
      <CapacityMatrix portfolio={portfolio} />

      {/* Portfolio cards */}
      <div className="grid gap-5 lg:grid-cols-2">
        {portfolio.map((m) => (
          <ProductCard key={m.ws.id} m={m} now={now} />
        ))}
      </div>

      {/* Provenance summary strip (owner-only: live-sync instructions + a real
          product curl example — NOT shown on the anonymous demo) */}
      {!demo && (
      <section className="silhat-panel p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-100">Sources — live availability</h2>
          <span className="rounded border border-gray-700 bg-gray-800/70 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-wider text-gray-400">
            provenance preserved
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-gray-400">
          Availability shown comes from the owner's <strong className="text-gray-200">live-sync</strong> Chrome
          extension (reads only the visible text of an authenticated cto.new / ChatGPT page — never
          tokens or private state). Source + timestamp are kept on every row. No observation =
          <em> reference baseline</em> — never invented.
        </p>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-gray-400">
          <li>
            In the extension popup, set the <strong className="text-gray-200">Dashboard URL</strong> to this site's
            origin <code className="rounded bg-gray-900 px-1.5 py-0.5 font-mono text-xs text-[#7fb0ff]">{origin}</code>{" "}
            (the extension posts to <code className="font-mono text-gray-300">/api/sync</code> under it).
          </li>
          <li>
            Open an <strong className="text-gray-200">authenticated cto.new page</strong> (or a project's own page)
            and click <strong className="text-gray-200">Sync visible availability</strong> in the popup.
          </li>
          <li>
            The row is stored and Agent Direct reflects it as{" "}
            <em className="text-gray-300">live observation</em> with staleness-driven confidence.
          </li>
        </ol>
        <div className="mt-4 rounded-lg border border-gray-800 bg-gray-950/70 p-4">
          <div className="silhat-eyebrow">Direct ingestion (no extension)</div>
          <pre className="silhat-terminal mt-2 overflow-x-auto">{`curl -s -X POST ${origin}/api/availability \\
  -H 'Content-Type: application/json' \\
  -d '{"provider":"cto.new","cap":72,"url":"https://product.example.com/","observedAt":'"$(date +%s000)"',"method":"curl","confidence":"medium"}'`}</pre>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-gray-500">
            Endpoints: <span className="text-gray-300">POST/GET /api/availability</span> (canonical) and{" "}
            <span className="text-gray-300">POST/GET /api/sync</span> (extension path). Both accept the
            extension payload: provider, cap, next, url, title, observedAt, method, confidence
            (required: provider, url, observedAt).
          </p>
        </div>
      </section>
      )}

      {/* How to read this view — de-emphasized, collapsed-by-default secondary
          education affordance (content preserved, one click to expand) */}
      <ControlLegend />

      <p className="pb-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-gray-600">
        {demo
          ? "demo portfolio · sample data · not your real projects · readiness from evidence"
          : `real portfolio baseline · readiness from evidence · unassessed = needs assessment · ${state.products.length} products in ailhat store`}
      </p>
    </div>
  );
}

export default Control;
