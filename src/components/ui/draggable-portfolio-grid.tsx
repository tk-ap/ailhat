'use client';

import { type ReactNode, useMemo, useState } from "react";
import { motion, Reorder } from "motion/react";

export type PortfolioWidget = {
  id: string;
  content: ReactNode;
};

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

  return (
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
          <Reorder.Item
            key={id}
            value={id}
            as="div"
            layout
            dragListener
            whileDrag={{ scale: 1.01, zIndex: 20 }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="min-w-0 cursor-grab touch-none active:cursor-grabbing"
          >
            <motion.div layout="position" className="h-full">
              {widget.content}
            </motion.div>
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}
