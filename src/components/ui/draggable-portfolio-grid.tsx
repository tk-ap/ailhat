'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGroup, motion } from "motion/react";

export type PortfolioWidget = {
  id: string;
  /** Human name used for drag handles and move announcements. */
  label?: string;
  content: ReactNode;
};

const STORAGE_KEY = "ailhat.portfolio-order.v1";

function readSavedOrder(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.every((v) => typeof v === "string") ? parsed : null;
  } catch {
    return null;
  }
}

function saveOrder(order: string[] | null) {
  try {
    if (order) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode or blocked storage: the order simply is not remembered */
  }
}

/** Current ids in display order: saved order first, then any new products. */
function normalize(order: string[], ids: string[]) {
  return [...order.filter((id) => ids.includes(id)), ...ids.filter((id) => !order.includes(id))];
}

function move(list: string[], id: string, to: number) {
  const from = list.indexOf(id);
  if (from < 0) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = [...list];
  next.splice(from, 1);
  next.splice(target, 0, id);
  return next;
}

/**
 * Owner-reorderable portfolio grid.
 *
 * Reordering works across the whole grid, including the two-column layout at xl
 * widths: the dragged card moves to whichever card the pointer is over, on either
 * axis (Motion's Reorder only supports one axis). Keyboard: Alt + Left/Right moves
 * one place, Alt + Up/Down moves one row. Order is remembered in this browser only;
 * it changes the working view, not portfolio data.
 */
export function DraggablePortfolioGrid({ widgets }: { widgets: PortfolioWidget[] }) {
  const ids = useMemo(() => widgets.map((w) => w.id), [widgets]);
  const [order, setOrder] = useState<string[]>(ids);
  const [customized, setCustomized] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);

  // Restore after hydration so server and client render the same first frame.
  useEffect(() => {
    const saved = readSavedOrder();
    if (saved) {
      setOrder(saved);
      setCustomized(true);
    }
  }, []);

  const current = normalize(order, ids);
  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);
  const labelFor = (id: string) => byId.get(id)?.label || "Product";

  const commit = useCallback((next: string[]) => {
    setOrder(next);
    setCustomized(true);
    saveOrder(next);
  }, []);

  const columns = () => {
    const grid = gridRef.current;
    if (!grid) return 1;
    return getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
  };

  const announce = (id: string, list: string[]) =>
    setAnnouncement(`${labelFor(id)} moved to position ${list.indexOf(id) + 1} of ${list.length}.`);

  const onKeyDown = (id: string) => (event: React.KeyboardEvent) => {
    if (!event.altKey) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns(), ArrowDown: columns() }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = move(current, id, current.indexOf(id) + step);
    if (next !== current) {
      commit(next);
      announce(id, next);
    }
  };

  // Latest order for window-level drag handlers (they outlive a single render).
  const orderRef = useRef(current);
  orderRef.current = current;

  const announceRef = useRef(announce);
  announceRef.current = announce;

  // Drag listeners are attached to window synchronously on pointerdown. Not on the
  // handle: reordering moves the card in the DOM, which drops pointer capture, so a
  // handle-level pointerup would never arrive. Not in an effect either: a quick drag
  // can deliver its moves and its pointerup before an effect has run.
  const onPointerDown = (id: string) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const start = orderRef.current;
    let lastTarget: string | null = null;
    setDragging(id);

    const onMove = (e: PointerEvent) => {
      const under = document
        .elementsFromPoint(e.clientX, e.clientY)
        .map((el) => (el as HTMLElement).closest<HTMLElement>("[data-portfolio-item]"))
        .find((el) => el && el.dataset.portfolioItem !== id);
      const target = under?.dataset.portfolioItem;
      // Hysteresis: after swapping with a card, wait until the pointer is over a
      // different card, so cards of unequal height do not flip back and forth.
      if (!target || target === lastTarget) return;
      lastTarget = target;
      const list = orderRef.current;
      const next = move(list, id, list.indexOf(target));
      orderRef.current = next;
      setOrder(next);
    };
    const end = (cancel: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      setDragging(null);
      if (cancel) {
        orderRef.current = start;
        setOrder(start);
        return;
      }
      const next = orderRef.current;
      if (next.join() !== start.join()) {
        commit(next);
        announceRef.current(id, next);
      }
    };
    const onUp = () => end(false);
    const onCancel = () => end(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") end(true);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
  };

  const reset = () => {
    setOrder(ids);
    setCustomized(false);
    saveOrder(null);
    setAnnouncement("Portfolio order reset.");
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>Drag a card by its handle to set your working order.</span>
        <span className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600">
          <span>Keyboard: Alt + arrows</span>
          {customized ? (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-gray-800 px-2 py-0.5 text-gray-400 transition hover:border-[#7fb0ff]/50 hover:text-[#7fb0ff]"
            >
              Reset order
            </button>
          ) : null}
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <LayoutGroup>
        <div
          ref={gridRef}
          role="list"
          aria-label="Portfolio products. Drag a card by its handle, or use Alt and the arrow keys, to reorder your working view."
          className="grid gap-5 xl:grid-cols-2"
        >
          {current.map((id) => {
            const widget = byId.get(id);
            if (!widget) return null;
            const isDragging = dragging === id;
            return (
              <motion.div
                key={id}
                role="listitem"
                layout
                data-portfolio-item={id}
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
                className={`min-w-0 rounded-xl transition-shadow ${
                  isDragging ? "relative z-20 shadow-[0_0_0_1px_rgba(127,176,255,0.55),0_18px_40px_-16px_rgba(0,0,0,0.8)]" : ""
                }`}
              >
                <div className="mb-2 flex items-center justify-end">
                  <button
                    type="button"
                    aria-label={`Reorder ${widget.label || "this product"}. Drag, or press Alt and an arrow key.`}
                    aria-pressed={isDragging}
                    title="Drag to reorder"
                    onPointerDown={onPointerDown(id)}
                    onKeyDown={onKeyDown(id)}
                    className={`inline-flex touch-none select-none items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                      isDragging
                        ? "cursor-grabbing border-[#7fb0ff]/60 bg-[#7fb0ff]/10 text-[#7fb0ff]"
                        : "cursor-grab border-gray-800 bg-gray-950/70 text-gray-400 hover:border-[#7fb0ff]/50 hover:text-[#7fb0ff]"
                    }`}
                  >
                    <span aria-hidden="true" className="text-sm leading-none">
                      ⋮⋮
                    </span>
                    Drag
                  </button>
                </div>
                <div className={isDragging ? "pointer-events-none" : undefined}>{widget.content}</div>
              </motion.div>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
