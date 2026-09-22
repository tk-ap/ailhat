import { useEffect, useMemo, useState } from "react";
import type { WorkItem } from "~/lib/directives";
import {
  ACTIVE_SANDBOX_EXECUTION_STATES,
  type SandboxExecution,
  type SandboxExecutionBackendConnection,
  type SandboxExecutionEnvironment,
} from "~/lib/sandbox-execution";

type Overview = {
  connection?: SandboxExecutionBackendConnection;
  sandbox?: SandboxExecutionEnvironment | null;
  executions?: SandboxExecution[];
  error?: string;
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function summary(value: Record<string, unknown> | null | undefined): string | null {
  if (!value) return null;
  for (const key of ["summary","statement","result","finding","message"]) {
    const text = String(value[key] ?? "").trim();
    if (text) return text;
  }
  return null;
}

export default function SandboxExecutionPanel({ item }: { item: WorkItem }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const latest = overview?.executions?.[0] ?? null;
  const active = latest ? ACTIVE_SANDBOX_EXECUTION_STATES.has(latest.status) : false;
  const ready = Boolean(overview?.connection?.configured && overview?.sandbox?.lifecycle === "live");

  const refresh = async () => {
    const response = await fetch(`/api/agent-direct-executions?productId=${encodeURIComponent(item.workspace.id)}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as Overview;
    setOverview(response.ok ? data : { error: data.error ?? "Sandbox execution state unavailable." });
  };

  useEffect(() => { void refresh(); }, [item.workspace.id]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [active, item.workspace.id]);

  const blocker = useMemo(() => {
    if (overview?.error) return overview.error;
    if (!overview?.sandbox) return "Register a live stable sandbox before executing.";
    if (!overview?.connection?.configured) return "AgentOS execution transport is not connected yet. Prepared directives still work normally.";
    return null;
  }, [overview]);

  const run = async () => {
    if (!ready || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/agent-direct-executions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: item.workspace.id, workItem: item }),
      });
      const data = await response.json().catch(() => ({})) as { execution?: SandboxExecution; error?: string };
      if (!response.ok || !data.execution) {
        setMessage(data.error ?? "Sandbox execution could not be queued.");
        return;
      }
      setMessage("Queued for governed sandbox execution.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-[#7fb0ff]/20 bg-gray-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="silhat-eyebrow">Governed sandbox result</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-100">Run the prepared work without touching production</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-400">
            ailhat queues owner intent; AgentOS owns routing, authority, worker lifecycle, and review. A sandbox PASS never implies production PASS.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
          ready ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-gray-700 bg-gray-900 text-gray-500"
        }`}>
          {ready ? "Sandbox execution ready" : "Prepared-only"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!ready || busy || active}
          onClick={() => void run()}
          className="silhat-btn silhat-btn-primary min-h-11 px-4 disabled:opacity-40"
        >
          {busy ? "Queuing…" : active ? "Work in progress" : "Run in sandbox"}
        </button>
        {overview?.sandbox?.sandboxUrl && (
          <a
            href={overview.sandbox.sandboxUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center rounded-lg border border-gray-800 px-3 py-2 text-xs font-semibold text-[#9cc8ff] hover:border-gray-700"
          >
            Open sandbox ↗
          </a>
        )}
        {blocker && <span className="text-xs text-gray-500">{blocker}</span>}
        {message && <span className="text-xs text-[#9cc8ff]">{message}</span>}
      </div>

      {latest && (
        <div className="mt-5 rounded-lg border border-gray-800 bg-gray-950/55 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-200">{item.title}</p>
            <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{statusLabel(latest.status)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
            <span>execution · {latest.id}</span>
            {latest.runtimeTaskId && <span>task · {latest.runtimeTaskId}</span>}
            {latest.sandbox.currentVersionId && <span>version · {latest.sandbox.currentVersionId}</span>}
          </div>
          {summary(latest.outcome) && <p className="mt-3 text-sm leading-6 text-gray-300">{summary(latest.outcome)}</p>}
          {latest.review && (
            <p className="mt-2 text-xs leading-5 text-gray-500">
              Review · {String(latest.review.verdict ?? "pending")}{summary(latest.review) ? ` · ${summary(latest.review)}` : ""}
            </p>
          )}
          {latest.evidence.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-semibold text-gray-400">Evidence · {latest.evidence.length}</summary>
              <ul className="mt-2 space-y-1 text-xs text-gray-500">
                {latest.evidence.slice(0, 6).map((entry, index) => (
                  <li key={index}>{summary(entry) ?? JSON.stringify(entry)}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
