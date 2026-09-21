'use client';

import { type ReactNode, useMemo, useState } from "react";
import { motion, Reorder, useDragControls } from "motion/react";

export type PortfolioWidget = {
  id: string;
  content: ReactNode;
};

function DraggablePortfolioItem({
  id,
  content,
  onMove,
}: {
  id: string;
  content: ReactNode;
  onMove: (id: string, delta: number) => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={id}
      as="div"
      layout
      dragControls={controls}
      dragListener={false}
      whileDrag={{ scale: 1.01, zIndex: 20 }}
      transition={{ type: "spring", stiffness: 360, damping: 34 }}
      className="min-w-0"
    >
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          aria-label="Drag to reorder this product"
          title="Drag to reorder"
          onPointerDown={(event) => controls.start(event)}
          onKeyDown={(event) => {
            if (!event.altKey) return;
            if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
              event.preventDefault();
              onMove(id, -1);
            }
            if (event.key === "ArrowDown" || event.key === "ArrowRight") {
              event.preventDefault();
              onMove(id, 1);
            }
          }}
          className="inline-flex cursor-grab touch-none items-center gap-1.5 rounded-md border border-gray-800 bg-gray-950/70 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 transition hover:border-[#7fb0ff]/50 hover:text-[#7fb0ff] active:cursor-grabbing"
        >
          <span aria-hidden="true" className="text-sm leading-none">⋮⋮</span>
          Drag
        </button>
      </div>
      <motion.div layout="position" className="h-full">
        {content}
      </motion.div>
    </Reorder.Item>
  );
}

export function DraggablePortfolioGrid({
  widgets,
}: {
  widgets: PortfolioWidget[];
}) {
  const initial = useMemo(() => widgets.map((widget) => widget.id), [widgets]);
  const [order, setOrder] = useState(initial);

  const normalizedOrder = [
    ...order.filter((id) => widgets.some((widget) => widget.id === id)),
    ...widgets.map((widget) => widget.id).filter((id) => !order.includes(id)),
  ];

  const byId = new Map(widgets.map((widget) => [widget.id, widget]));

  const moveByKeyboard = (id: string, delta: number) => {
    setOrder((current) => {
      const normalized = [
        ...current.filter((itemId) =>
          widgets.some((widget) => widget.id === itemId),
        ),
        ...widgets
          .map((widget) => widget.id)
          .filter((itemId) => !current.includes(itemId)),
      ];
      const from = normalized.indexOf(id);
      if (from < 0) return normalized;
      const to = Math.max(0, Math.min(normalized.length - 1, from + delta));
      if (to === from) return normalized;
      const next = [...normalized];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>Reorder your portfolio cards by dragging the handle.</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-gray-600">
          Keyboard: Alt + arrows
        </span>
      </div>
      <Reorder.Group
        axis="y"
        values={normalizedOrder}
        onReorder={setOrder}
        className="grid gap-5 xl:grid-cols-2"
        aria-label="Portfolio products. Drag cards to reorder your working view."
      >
        {normalizedOrder.map((id) => {
          const widget = byId.get(id);
          if (!widget) return null;
          return (
            <DraggablePortfolioItem
              key={id}
              id={id}
              content={widget.content}
              onMove={moveByKeyboard}
            />
          );
        })}
      </Reorder.Group>
    </div>
  );
}
