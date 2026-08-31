import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  loadPreparedWork,
  removePreparedWorkItem,
  subscribePreparedWork,
} from "~/lib/prepared-work";
import {
  compileSignalWorkItemJson,
  compileSignalWorkItemMarkdown,
  type SignalWorkItem,
} from "~/lib/signal-work-item";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function PreparedWorkTray() {
  const location = useLocation();
  const [items, setItems] = useState<SignalWorkItem[]>([]);
  const [format, setFormat] = useState<"markdown" | "json">("markdown");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const refresh = () => setItems(loadPreparedWork());
    refresh();
    return subscribePreparedWork(refresh);
  }, []);

  const latest = items[0];
  const isDirect = location.pathname === "/control";
  const payload = useMemo(() => {
    if (!latest) return "";
    return format === "markdown"
      ? compileSignalWorkItemMarkdown(latest)
      : compileSignalWorkItemJson(latest);
  }, [latest, format]);

  if (!latest) return null;

  if (!isDirect) {
    return (
      <section className="mb-5 rounded-xl border border-[#7fb0ff]/20 bg-[#7fb0ff]/[0.05] px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="silhat-eyebrow">Prepared work · continuity</p>
            <p className="mt-1 truncate text-sm font-semibold text-gray-100">{latest.title}</p>
            <p className="mt-1 text-xs text-gray-500">
              {latest.product.name ?? "Portfolio"} · prepared, not executed · {items.length} queued
            </p>
          </div>
          <Link to="/control" className="silhat-btn silhat-btn-primary shrink-0">
            Open in Direct →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-[#7fb0ff]/25 bg-[#7fb0ff]/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="silhat-eyebrow">Prepared from Intelligence</p>
          <h2 className="mt-1 text-base font-semibold text-gray-100">{latest.title}</h2>
          <p className="mt-1 text-xs text-gray-500">
            {latest.product.name ?? "Portfolio-level signal"} · {latest.mode} · prepared, not executed
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFormat("markdown")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              format === "markdown"
                ? "bg-[#7fb0ff] text-[#0a0a0a]"
                : "border border-gray-700 text-gray-300"
            }`}
          >
            Markdown
          </button>
          <button
            type="button"
            onClick={() => setFormat("json")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              format === "json"
                ? "bg-[#7fb0ff] text-[#0a0a0a]"
                : "border border-gray-700 text-gray-300"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2 text-xs text-amber-100/90">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-300">
          execution state · prepared only
        </span>
        <p className="mt-1">{latest.execution.note}</p>
      </div>

      <pre className="silhat-terminal mt-3 max-h-80 overflow-auto whitespace-pre-wrap p-3 text-xs leading-relaxed">
        {payload}
      </pre>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            if (await copyText(payload)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="silhat-btn silhat-btn-primary"
        >
          {copied ? "Copied ✓" : "Copy artifact"}
        </button>
        <Link
          to="/product/$productId"
          params={{ productId: latest.product.id ?? "" }}
          className={`silhat-btn silhat-btn-ghost ${latest.product.id ? "" : "pointer-events-none opacity-50"}`}
        >
          Product Cockpit
        </Link>
        <button
          type="button"
          onClick={() => setItems(removePreparedWorkItem(latest.id))}
          className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-800 hover:text-gray-300"
        >
          Remove from prepared queue
        </button>
      </div>

      {items.length > 1 && (
        <p className="mt-3 text-[11px] text-gray-600">
          {items.length - 1} additional prepared item{items.length - 1 === 1 ? "" : "s"} remain queued.
        </p>
      )}
    </section>
  );
}
