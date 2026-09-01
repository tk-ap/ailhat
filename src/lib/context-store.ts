import {
  CONTEXT_ENVELOPE_SCHEMA,
  isContextEnvelope,
  type ContextEnvelope,
  type ContextScope,
  type ContextSubjectType,
  type ContextType,
} from "~/lib/context-envelope";

const STORAGE_KEY = "ailhat.context-envelopes.v1";
const EVENT_NAME = "ailhat:context-envelopes";
const MAX_ITEMS = 250;

export function loadContextEnvelopes(): ContextEnvelope[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isContextEnvelope).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function persist(items: ContextEnvelope[]) {
  if (typeof window === "undefined") return;
  const deduped = new Map<string, ContextEnvelope>();
  for (const item of items) {
    const existing = deduped.get(item.contextId);
    if (!existing || item.updatedAt >= existing.updatedAt) deduped.set(item.contextId, item);
  }
  const next = [...deduped.values()]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_ITEMS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // Context persistence failure must not alter portfolio evidence or workflow state.
  }
}

export function addContextEnvelope(item: ContextEnvelope) {
  persist([item, ...loadContextEnvelopes()]);
}

export function importContextEnvelopes(items: ContextEnvelope[]): number {
  const valid = items.filter(isContextEnvelope);
  if (valid.length === 0) return 0;
  persist([...valid, ...loadContextEnvelopes()]);
  return valid.length;
}

export function removeContextEnvelope(contextId: string) {
  persist(loadContextEnvelopes().filter((item) => item.contextId !== contextId));
}

export function subscribeContextEnvelopes(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}

export function createUserContextEnvelope(input: {
  contextType: ContextType;
  content: string;
  subjectType?: ContextSubjectType;
  subjectId?: string;
  sourceUrl?: string;
  scope?: ContextScope;
  domain?: string;
  extensions?: Record<string, unknown>;
}): ContextEnvelope {
  const now = new Date().toISOString();
  return {
    schema: CONTEXT_ENVELOPE_SCHEMA,
    contextId: `ctx:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    subjectType: input.subjectType ?? "portfolio",
    subjectId: input.subjectId,
    contextType: input.contextType,
    content: input.content.trim(),
    provenance: {
      sourceProduct: "ailhat",
      sourceUrl: input.sourceUrl?.trim() || undefined,
      suppliedBy: "user",
      observedAt: now,
    },
    verificationStatus: "user-supplied",
    sensitivity: "normal",
    scope: input.scope ?? "shared",
    domain: input.domain,
    extensions: input.extensions,
  };
}
