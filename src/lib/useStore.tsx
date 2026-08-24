import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  type AppState,
  type FeedbackKind,
  type Item,
  type ItemStatus,
  type ItemType,
  type Platform,
  type Product,
  SNOOZE_MS,
  addItem,
  addProduct,
  deleteItem,
  deleteProduct,
  loadState,
  resetData,
  saveState,
  setFeedback,
  setScan,
  recordScan,
  setOpportunities,
  setOpportunityFeedback,
  updateItem,
  updateProduct,
} from "./store";
import type { ScanResult } from "./scanSite";
import type { Opportunity } from "./opportunity";
import { useAuth } from "./useAuth";

// The store module never touches localStorage at import time, so importing it is
// SSR-safe. This hook loads from localStorage only after mount (client), which
// avoids hydration mismatches.

export interface Actions {
  addProduct: (p: Omit<Product, "id" | "createdAt">) => void;
  updateProduct: (
    id: string,
    patch: Partial<Omit<Product, "id" | "createdAt">>,
  ) => void;
  deleteProduct: (id: string) => void;
  addItem: (i: Omit<Item, "id" | "createdAt">) => void;
  setItemStatus: (id: string, status: ItemStatus) => void;
  updateItem: (
    id: string,
    patch: Partial<Omit<Item, "id" | "productId" | "createdAt">>,
  ) => void;
  deleteItem: (id: string) => void;
  setScan: (productId: string, result: ScanResult) => void;
  recordScan: (productId: string, result: ScanResult) => void;
  setFeedback: (signalId: string, kind: FeedbackKind) => void;
  setOpportunities: (opps: Opportunity[]) => void;
  setOpportunityFeedback: (oppId: string, kind: FeedbackKind) => void;
  resetData: () => void;
}

interface Ctx {
  state: AppState;
  ready: boolean;
  actions: Actions;
}

const StoreContext = createContext<Ctx | null>(null);

const EMPTY: AppState = {
  products: [],
  items: [],
  scans: {},
  scanHistory: {},
  feedback: {},
  opportunities: [],
  opportunityFeedback: {},
};

// Normalise an untrusted server payload into a valid AppState shape.
function normalizeState(raw: AppState | null | undefined): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AppState>;
  if (!Array.isArray(r.products)) return null;
  return {
    products: r.products,
    items: Array.isArray(r.items) ? r.items : [],
    scans: r.scans ?? {},
    scanHistory: r.scanHistory ?? {},
    feedback: r.feedback ?? {},
    opportunities: Array.isArray(r.opportunities) ? r.opportunities : [],
    opportunityFeedback: r.opportunityFeedback ?? {},
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(EMPTY);
  const mounted = useRef(false);
  const { user } = useAuth();

  // Latest state kept in a ref so the async hydration path and debounced save can
  // read the freshest value without stale closures.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Which user (or "anon") the store is currently hydrated for. Prevents a save
  // from clobbering server state before hydration, and re-hydrates on account change.
  const hydratedFor = useRef<string | null>(null);

  const saveToServer = useCallback(async () => {
    try {
      await fetch("/api/portfolio", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(stateRef.current),
      });
    } catch {
      // Non-fatal: the anonymous/localStorage path still works; we retry on the
      // next state change.
    }
  }, []);

  // One-time mount: load from localStorage + wire cross-tab sync.
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    setState(loadState());
    const onStore = (e: StorageEvent) => {
      if (e.key === null || e.key?.startsWith("sortie")) {
        setState(loadState());
      }
    };
    window.addEventListener("storage", onStore);
    return () => window.removeEventListener("storage", onStore);
  }, []);

  // Hydrate from the server the moment a user is present. For anonymous users we
  // just mark ready (localStorage path preserved).
  useEffect(() => {
    const uid = user ? String(user.id) : null;
    if (uid === null) {
      hydratedFor.current = "anon";
      setReady(true);
      return;
    }
    if (hydratedFor.current === uid) {
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    (async () => {
      let serverState: AppState | null = null;
      try {
        const res = await fetch("/api/portfolio", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { state: AppState | null };
          serverState = normalizeState(data.state);
        }
      } catch {
        serverState = null;
      }
      if (cancelled) return;
      hydratedFor.current = uid;
      if (serverState) {
        setState(serverState);
        saveState(serverState);
      } else {
        // First login with no saved server state: push the current (local) state
        // up once so it persists immediately.
        void saveToServer();
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, saveToServer]);

  // Debounced background save to the server on every state change while logged in.
  useEffect(() => {
    if (!user) return;
    if (hydratedFor.current !== String(user.id)) return; // don't clobber before hydration
    const t = setTimeout(() => {
      void saveToServer();
    }, 800);
    return () => clearTimeout(t);
  }, [state, user, saveToServer]);

  const commit = useCallback((next: AppState) => {
    setState(next);
    saveState(next);
  }, []);

  const actions: Actions = {
    addProduct: (p) => commit(addProduct(state, p)),
    updateProduct: (id, patch) => commit(updateProduct(state, id, patch)),
    deleteProduct: (id) => commit(deleteProduct(state, id)),
    addItem: (i) => commit(addItem(state, i)),
    setItemStatus: (id, status) => commit(updateItem(state, id, { status })),
    updateItem: (id, patch) => commit(updateItem(state, id, patch)),
    deleteItem: (id) => commit(deleteItem(state, id)),
    setScan: (productId, result) => commit(setScan(state, productId, result)),
    recordScan: (productId, result) => commit(recordScan(state, productId, result)),
    setFeedback: (signalId, kind) =>
      commit(
        setFeedback(state, signalId, {
          kind,
          ...(kind === "snoozed" ? { until: Date.now() + SNOOZE_MS } : {}),
        }),
      ),
    setOpportunities: (opps) => commit(setOpportunities(state, opps)),
    setOpportunityFeedback: (oppId, kind) =>
      commit(
        setOpportunityFeedback(state, oppId, {
          kind,
          ...(kind === "snoozed" ? { until: Date.now() + SNOOZE_MS } : {}),
        }),
      ),
    resetData: () => commit(resetData()),
  };

  return (
    <StoreContext.Provider value={{ state, ready, actions }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

// Helper to keep unused type imports out of the way (Platform, ItemType used by
// callers via re-export convenience). Re-export types used across the UI.
export type { ItemStatus, ItemType, Platform, Product, Item, AppState };
