import type { SignalWorkItem } from "./signal-work-item";

const KEY = "ailhat.prepared-work.v1";
const EVENT = "ailhat:prepared-work";
const MAX_ITEMS = 40;

export function loadPreparedWork(): SignalWorkItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SignalWorkItem =>
        !!item &&
        typeof item === "object" &&
        (item as SignalWorkItem).schema === "ailhat.signal-work-item/v1" &&
        typeof (item as SignalWorkItem).id === "string",
    );
  } catch {
    return [];
  }
}

function persist(items: SignalWorkItem[]): SignalWorkItem[] {
  const bounded = items.slice(0, MAX_ITEMS);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(bounded));
      window.dispatchEvent(new CustomEvent(EVENT));
    } catch {
      // Prepared work is continuity state. A storage failure must never mutate
      // portfolio evidence or claim that execution occurred.
    }
  }
  return bounded;
}

export function savePreparedWorkItem(item: SignalWorkItem): SignalWorkItem[] {
  const existing = loadPreparedWork().filter((current) => current.id !== item.id);
  return persist([item, ...existing]);
}

export function removePreparedWorkItem(id: string): SignalWorkItem[] {
  return persist(loadPreparedWork().filter((item) => item.id !== id));
}

export function clearPreparedWork(): SignalWorkItem[] {
  return persist([]);
}

export function subscribePreparedWork(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener(EVENT, listener as EventListener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, listener as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
