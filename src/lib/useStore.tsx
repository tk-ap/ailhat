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
  type ProductDecision,
  type DecisionDisposition,
  type ProductEngagementEvidence,
  type RetiredProductArchive,
  SNOOZE_MS,
  addItem,
  addProduct,
  deleteItem,
  deleteProduct,
  reactivateProduct,
  resetData,
  retireProduct,
  saveState,
  setDecisions,
  setDecisionDisposition,
  setEngagementEvidence,
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
import { clearTenantPrivateStorage } from "./tenant-client-storage";

export interface Actions {
  addProduct: (p: Omit<Product, "id" | "createdAt">) => void;
  updateProduct: (id: string, patch: Partial<Omit<Product, "id" | "createdAt">>) => void;
  deleteProduct: (id: string) => void;
  retireProduct: (id: string, reason?: string) => void;
  reactivateProduct: (id: string) => void;
  setEngagementEvidence: (productId: string, evidence: ProductEngagementEvidence) => void;
  addItem: (i: Omit<Item, "id" | "createdAt">) => void;
  setItemStatus: (id: string, status: ItemStatus) => void;
  updateItem: (id: string, patch: Partial<Omit<Item, "id" | "productId" | "createdAt">>) => void;
  deleteItem: (id: string) => void;
  setScan: (productId: string, result: ScanResult) => void;
  recordScan: (productId: string, result: ScanResult) => void;
  setDecisions: (productId: string, decisions: ProductDecision[]) => void;
  setDecisionDisposition: (productId: string, decisionId: string, disposition: DecisionDisposition, reason?: string) => void;
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

export const EMPTY_APP_STATE: AppState = {
  products: [], retiredProducts: [], items: [], decisions: {}, scans: {}, scanHistory: {},
  productActivity: {}, engagement: {}, feedback: {}, opportunities: [], opportunityFeedback: {},
};

export function normalizeState(raw: AppState | null | undefined): AppState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<AppState>;
  if (!Array.isArray(r.products)) return null;
  return {
    products: r.products,
    retiredProducts: Array.isArray(r.retiredProducts) ? (r.retiredProducts as RetiredProductArchive[]) : [],
    items: Array.isArray(r.items) ? r.items : [],
    decisions: r.decisions && typeof r.decisions === "object" && !Array.isArray(r.decisions) ? (r.decisions as Record<string, ProductDecision[]>) : {},
    scans: r.scans ?? {}, scanHistory: r.scanHistory ?? {}, productActivity: r.productActivity ?? {},
    engagement: r.engagement ?? {}, feedback: r.feedback ?? {},
    opportunities: Array.isArray(r.opportunities) ? r.opportunities : [],
    opportunityFeedback: r.opportunityFeedback ?? {},
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<AppState>(EMPTY_APP_STATE);
  const { user, loading: authLoading, access } = useAuth();
  const stateRef = useRef(state);
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => { stateRef.current = state; }, [state]);

  const saveToServer = useCallback(async (value?: AppState) => {
    try {
      await fetch("/api/portfolio", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value ?? stateRef.current),
      });
    } catch { /* retry on a later authenticated state change */ }
  }, []);

  useEffect(() => {
    if (authLoading) {
      setReady(false);
      return;
    }

    const uid = user ? String(user.id) : null;
    if (uid === null) {
      if (hydratedFor.current !== "anon") clearTenantPrivateStorage();
      hydratedFor.current = "anon";
      setState(EMPTY_APP_STATE);
      setReady(true);
      return;
    }

    // Authentication is not sufficient for customer data access. An expired or
    // revoked beta account keeps its login identity but never hydrates portfolio
    // data into the browser.
    if (access?.productAccess !== true) {
      if (hydratedFor.current !== `blocked:${uid}`) clearTenantPrivateStorage();
      hydratedFor.current = `blocked:${uid}`;
      setState(EMPTY_APP_STATE);
      setReady(true);
      return;
    }

    if (hydratedFor.current === uid) {
      setReady(true);
      return;
    }
    if (hydratedFor.current !== null && hydratedFor.current !== uid) clearTenantPrivateStorage();

    let cancelled = false;
    setReady(false);
    setState(EMPTY_APP_STATE);
    (async () => {
      let serverState: AppState | null = null;
      try {
        const response = await fetch("/api/portfolio", { cache: "no-store" });
        if (response.ok) {
          const data = (await response.json()) as { state: AppState | null };
          serverState = normalizeState(data.state);
        }
      } catch { serverState = null; }
      if (cancelled) return;
      hydratedFor.current = uid;
      const next = serverState ?? EMPTY_APP_STATE;
      setState(next);
      saveState(next);
      if (!serverState) void saveToServer(EMPTY_APP_STATE);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [authLoading, user?.id, access?.productAccess, saveToServer]);

  useEffect(() => {
    if (!user || !ready || access?.productAccess !== true) return;
    if (hydratedFor.current !== String(user.id)) return;
    const timer = setTimeout(() => { void saveToServer(); }, 800);
    return () => clearTimeout(timer);
  }, [state, user, ready, access?.productAccess, saveToServer]);

  const commit = useCallback((next: AppState) => {
    if (!user || access?.productAccess !== true || hydratedFor.current !== String(user.id)) return;
    setState(next);
    saveState(next);
  }, [user, access?.productAccess]);

  const actions: Actions = {
    addProduct: (p) => commit(addProduct(state, p)),
    updateProduct: (id, patch) => commit(updateProduct(state, id, patch)),
    deleteProduct: (id) => commit(deleteProduct(state, id)),
    retireProduct: (id, reason) => commit(retireProduct(state, id, reason)),
    reactivateProduct: (id) => commit(reactivateProduct(state, id)),
    setEngagementEvidence: (productId, evidence) => commit(setEngagementEvidence(state, productId, evidence)),
    addItem: (i) => commit(addItem(state, i)),
    setItemStatus: (id, status) => commit(updateItem(state, id, { status })),
    updateItem: (id, patch) => commit(updateItem(state, id, patch)),
    deleteItem: (id) => commit(deleteItem(state, id)),
    setScan: (productId, result) => commit(setScan(state, productId, result)),
    recordScan: (productId, result) => commit(recordScan(state, productId, result)),
    setDecisions: (productId, decisions) => commit(setDecisions(state, productId, decisions)),
    setDecisionDisposition: (productId, decisionId, disposition, reason) => commit(setDecisionDisposition(state, productId, decisionId, disposition, reason)),
    setFeedback: (signalId, kind) => commit(setFeedback(state, signalId, { kind, ...(kind === "snoozed" ? { until: Date.now() + SNOOZE_MS } : {}) })),
    setOpportunities: (opps) => commit(setOpportunities(state, opps)),
    setOpportunityFeedback: (oppId, kind) => commit(setOpportunityFeedback(state, oppId, { kind, ...(kind === "snoozed" ? { until: Date.now() + SNOOZE_MS } : {}) })),
    resetData: () => commit(resetData(state, !user)),
  };

  return <StoreContext.Provider value={{ state, ready, actions }}>{children}</StoreContext.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export type { ItemStatus, ItemType, Platform, Product, Item, AppState, ProductEngagementEvidence, RetiredProductArchive };
