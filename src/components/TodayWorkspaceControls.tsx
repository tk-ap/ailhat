import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "~/lib/useStore";
import {
  loadTodayPreferences,
  orderedProductIds,
  saveTodayPreferences,
  type TodayPreferences,
} from "~/lib/today-workspace";

function findProductCard(productName: string): HTMLElement | null {
  const headings = Array.from(document.querySelectorAll<HTMLElement>("main h3"));
  const heading = headings.find((node) => node.textContent?.trim() === productName);
  return heading?.closest<HTMLElement>(".silhat-panel") ?? null;
}

function ensureControlHost(card: HTMLElement, productId: string): HTMLElement | null {
  const header = card.firstElementChild as HTMLElement | null;
  if (!header) return null;
  const existing = header.querySelector<HTMLElement>(`[data-today-controls="${productId}"]`);
  if (existing) return existing;
  const host = document.createElement("div");
  host.dataset.todayControls = productId;
  host.className = "mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-800 pt-3";
  header.appendChild(host);
  return host;
}

function setDisplay(node: HTMLElement | null, value: string) {
  if (node) node.style.display = value;
}

function applyCollapsed(card: HTMLElement, collapsed: boolean) {
  const cardChildren = Array.from(card.children) as HTMLElement[];
  const header = cardChildren[0] ?? null;

  cardChildren.forEach((child, index) => {
    if (index === 0) return;
    child.style.display = collapsed ? "none" : "";
  });

  if (!header) return;
  card.dataset.todayDensity = collapsed ? "condensed" : "expanded";
  header.style.padding = collapsed ? "0.55rem 0.75rem" : "";
  header.style.borderBottomWidth = collapsed ? "0" : "";

  const controls = header.querySelector<HTMLElement>("[data-today-controls]");
  if (controls) {
    controls.style.marginTop = collapsed ? "0.45rem" : "";
    controls.style.paddingTop = collapsed ? "0.45rem" : "";
    controls.style.gap = collapsed ? "0.25rem" : "";
  }

  const summary = header.firstElementChild as HTMLElement | null;
  if (!summary || summary === controls) return;

  const heading = summary.querySelector<HTMLElement>("h3");
  const identityRow = heading?.parentElement as HTMLElement | null;
  const identityColumn = identityRow?.parentElement as HTMLElement | null;

  if (identityColumn) {
    Array.from(identityColumn.children).forEach((child) => {
      const el = child as HTMLElement;
      if (el === identityRow) return;
      el.style.display = collapsed ? "none" : "";
    });
  }

  if (heading) {
    heading.style.fontSize = collapsed ? "0.95rem" : "";
    heading.style.lineHeight = collapsed ? "1.25rem" : "";
  }

  const actionColumn = summary.children[1] as HTMLElement | undefined;
  if (actionColumn) {
    Array.from(actionColumn.children).forEach((child) => {
      const el = child as HTMLElement;
      const isOpenCount = el.tagName === "SPAN" && /open/i.test(el.textContent ?? "");
      setDisplay(el, collapsed && !isOpenCount ? "none" : "");
    });
    actionColumn.style.alignItems = collapsed ? "center" : "";
  }

  summary.style.alignItems = collapsed ? "center" : "";
  summary.style.gap = collapsed ? "0.5rem" : "";
}

export default function TodayWorkspaceControls() {
  const { state, actions } = useStore();
  const [prefs, setPrefs] = useState<TodayPreferences>({});
  const [hosts, setHosts] = useState<Record<string, HTMLElement>>({});
  const [retireConfirm, setRetireConfirm] = useState<string | null>(null);

  useEffect(() => setPrefs(loadTodayPreferences()), []);

  const ordered = useMemo(() => {
    const ids = orderedProductIds(state.products, prefs);
    return ids
      .map((id) => state.products.find((product) => product.id === id))
      .filter((product): product is (typeof state.products)[number] => !!product);
  }, [state.products, prefs]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nextHosts: Record<string, HTMLElement> = {};
      ordered.forEach((product, index) => {
        const card = findProductCard(product.name);
        if (!card) return;
        card.style.order = String(index);
        const host = ensureControlHost(card, product.id);
        applyCollapsed(card, prefs[product.id]?.collapsed ?? false);
        if (host) nextHosts[product.id] = host;
      });
      setHosts(nextHosts);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ordered, prefs]);

  const commit = (next: TodayPreferences) => {
    setPrefs(next);
    saveTodayPreferences(next);
  };

  const normalizeOrder = (
    ids: string[],
    base: TodayPreferences,
    overrides: Record<string, Partial<TodayPreferences[string]>> = {},
  ) => {
    const next = { ...base };
    ids.forEach((productId, index) => {
      next[productId] = {
        collapsed: next[productId]?.collapsed ?? false,
        order: index,
        ...(next[productId]?.restoreOrder !== undefined
          ? { restoreOrder: next[productId]?.restoreOrder }
          : {}),
        ...(overrides[productId] ?? {}),
      };
    });
    return next;
  };

  const setCollapsed = (id: string, collapsed: boolean) => {
    const ids = ordered.map((product) => product.id);
    const currentIndex = ids.indexOf(id);
    if (currentIndex < 0) return;

    if (collapsed) {
      // Remember the user's current priority position, then move this product to
      // the end of Today. Condense therefore means "de-prioritise for now", not
      // merely "hide some pixels".
      ids.splice(currentIndex, 1);
      ids.push(id);
      const next = normalizeOrder(ids, prefs, {
        [id]: {
          collapsed: true,
          restoreOrder: currentIndex,
        },
      });
      commit(next);
      return;
    }

    // Expand restores the position the product occupied immediately before it
    // was condensed. If that position is no longer available, clamp safely into
    // the current active portfolio ordering.
    ids.splice(currentIndex, 1);
    const remembered = prefs[id]?.restoreOrder ?? currentIndex;
    const target = Math.max(0, Math.min(remembered, ids.length));
    ids.splice(target, 0, id);
    const next = normalizeOrder(ids, prefs, {
      [id]: {
        collapsed: false,
        restoreOrder: target,
      },
    });
    commit(next);
  };

  const move = (id: string, delta: -1 | 1) => {
    if (prefs[id]?.collapsed) return;
    const ids = ordered.map((p) => p.id);
    const from = ids.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const next = normalizeOrder(ids, prefs, {
      [id]: { restoreOrder: to },
    });
    commit(next);
  };

  return (
    <>
      {ordered.map((product, index) => {
        const host = hosts[product.id];
        if (!host) return null;
        const collapsed = prefs[product.id]?.collapsed ?? false;
        return createPortal(
          <>
            {!collapsed && (
              <>
                <button
                  type="button"
                  onClick={() => move(product.id, -1)}
                  disabled={index === 0}
                  className="rounded-md border border-gray-700 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-gray-200 disabled:opacity-30"
                  title="Move this product earlier on Today"
                >
                  ↑ Earlier
                </button>
                <button
                  type="button"
                  onClick={() => move(product.id, 1)}
                  disabled={index === ordered.length - 1}
                  className="rounded-md border border-gray-700 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-gray-200 disabled:opacity-30"
                  title="Move this product later on Today"
                >
                  ↓ Later
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(product.id, !collapsed)}
              className="rounded-md border border-gray-700 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:border-[#7fb0ff]/50 hover:text-[#7fb0ff]"
              title={collapsed ? "Expand and restore this product's previous position" : "Condense and move this product to the bottom"}
            >
              {collapsed ? "Expand · restore" : "Condense"}
            </button>
            <a
              href={`/product/${encodeURIComponent(product.id)}`}
              className="rounded-md border border-gray-700 px-2 py-1 text-[10px] font-semibold text-gray-300 hover:border-[#7fb0ff]/50 hover:text-[#7fb0ff]"
            >
              Product cockpit
            </a>
            <button
              type="button"
              onClick={() => {
                if (retireConfirm === product.id) {
                  actions.retireProduct(product.id, "Retired from Today by owner.");
                  setRetireConfirm(null);
                } else {
                  setRetireConfirm(product.id);
                  window.setTimeout(
                    () =>
                      setRetireConfirm((value) =>
                        value === product.id ? null : value,
                      ),
                    3500,
                  );
                }
              }}
              className={`ml-auto rounded-md px-2 py-1 text-[10px] font-semibold ${
                retireConfirm === product.id
                  ? "bg-amber-500 text-amber-950"
                  : "border border-gray-700 text-gray-500 hover:border-amber-500/50 hover:text-amber-300"
              }`}
              title="Retire from active portfolio intelligence; context is preserved"
            >
              {retireConfirm === product.id ? "Confirm retire" : "Retire"}
            </button>
          </>,
          host,
        );
      })}
    </>
  );
}
