import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  loadPreparedWork,
  subscribePreparedWork,
} from "~/lib/prepared-work";
import { loadTodayPreferences } from "~/lib/today-workspace";

export default function ProductWorkspaceContinuityPortal() {
  const location = useLocation();
  const [mount, setMount] = useState<HTMLElement | null>(null);
  const [version, setVersion] = useState(0);

  const match = location.pathname.match(/^\/product\/([^/]+)$/);
  const productId = match ? decodeURIComponent(match[1]) : null;

  useEffect(() => {
    if (!productId) {
      setMount(null);
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      const main = document.querySelector<HTMLElement>("main");
      if (!main) return;
      const page = main.querySelector<HTMLElement>(".space-y-6");
      if (!page) return;
      const metricGrid = Array.from(page.children).find(
        (node) =>
          node instanceof HTMLElement &&
          node.tagName === "SECTION" &&
          node.className.includes("grid") &&
          node.className.includes("gap-3"),
      ) as HTMLElement | undefined;
      if (!metricGrid) return;

      let host = document.getElementById("product-workspace-continuity-mount");
      if (!host) {
        host = document.createElement("div");
        host.id = "product-workspace-continuity-mount";
        metricGrid.insertAdjacentElement("afterend", host);
      }
      setMount(host);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [productId, location.pathname]);

  useEffect(() => subscribePreparedWork(() => setVersion((value) => value + 1)), []);

  const context = useMemo(() => {
    if (!productId || typeof window === "undefined") return null;
    const today = loadTodayPreferences()[productId];
    const prepared = loadPreparedWork().filter((item) => item.product.id === productId);
    return { today, prepared };
  }, [productId, version, location.pathname]);

  if (!mount || !productId || !context) return null;

  const latest = context.prepared[0];
  const todayPosition = context.today ? `Position ${context.today.order + 1}` : "Default position";
  const todayDisplay = context.today?.collapsed ? "Condensed" : "Expanded";

  return createPortal(
    <section className="silhat-panel p-5" aria-labelledby="workspace-continuity-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="silhat-eyebrow">From workspace · shared product state</p>
          <h2 id="workspace-continuity-heading" className="mt-1 text-lg font-semibold text-gray-100">
            Workspace context follows this product
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Today, Intelligence, Direct, and this Product Cockpit are views over the same product context. Product-specific work should accumulate here instead of disappearing between surfaces.
          </p>
        </div>
        <Link to="/dashboard" className="text-xs font-semibold text-[#7fb0ff] hover:underline">
          Open Today →
        </Link>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Today</p>
          <p className="mt-2 text-sm font-semibold text-gray-200">{todayPosition} · {todayDisplay}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Reordering or condensing changes attention/layout only. It does not remove this product from scanning or intelligence.
          </p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Direct continuity</p>
          <p className="mt-2 text-sm font-semibold text-gray-200">
            {context.prepared.length} prepared work item{context.prepared.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
            {latest ? latest.title : "No Fix or Investigation has been prepared for this product yet."}
          </p>
          {latest && (
            <Link to="/control" className="mt-2 inline-block text-xs font-semibold text-[#7fb0ff] hover:underline">
              Continue latest in Direct →
            </Link>
          )}
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Canonical product record</p>
          <p className="mt-2 text-sm font-semibold text-gray-200">No duplicate workspace copy</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            Checklist work, scan history, findings, signals, opportunities, and decisions below are the live product records used by the rest of ailhat.
          </p>
        </div>
      </div>

      {context.prepared.length > 0 && (
        <div className="mt-4 border-t border-gray-800 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-gray-300">Prepared work carried into this product</p>
            <span className="text-[10px] uppercase tracking-wider text-gray-600">prepared · not executed</span>
          </div>
          <div className="mt-2 space-y-2">
            {context.prepared.slice(0, 3).map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-200">{item.title}</p>
                  <p className="mt-0.5 text-[11px] text-gray-600">{item.mode} · {new Date(item.generatedAt).toLocaleString()}</p>
                </div>
                <Link to="/control" className="shrink-0 text-xs font-semibold text-[#7fb0ff] hover:underline">
                  Open in Direct →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>,
    mount,
  );
}
