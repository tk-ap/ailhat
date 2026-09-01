import type { Item, Product } from "./store";

export type SolutionWorkflowStage =
  | "review"
  | "solution"
  | "prepared"
  | "implementation"
  | "verify"
  | "resolved";

export type SolutionWorkflowSource =
  | "scan-finding"
  | "post-scan-issue"
  | "external-opportunity";

export interface SolutionWorkflow {
  schema: "ailhat.solution-workflow/v1";
  id: string;
  productId: string;
  productName: string;
  itemId: string;
  itemTitle: string;
  scanKey?: string;
  source: SolutionWorkflowSource;
  stage: SolutionWorkflowStage;
  createdAt: string;
  updatedAt: string;
}

const KEY = "ailhat.solution-workflow.v1";
const EVENT = "ailhat:solution-workflow";
const MAX = 30;

export function loadSolutionWorkflows(): SolutionWorkflow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is SolutionWorkflow =>
        !!value &&
        typeof value === "object" &&
        (value as SolutionWorkflow).schema === "ailhat.solution-workflow/v1" &&
        typeof (value as SolutionWorkflow).id === "string",
    );
  } catch {
    return [];
  }
}

function persist(workflows: SolutionWorkflow[]): SolutionWorkflow[] {
  const bounded = workflows.slice(0, MAX);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(bounded));
      window.dispatchEvent(new CustomEvent(EVENT));
    } catch {
      // Continuity state must never block product-state persistence.
    }
  }
  return bounded;
}

function workflowSource(item: Item): SolutionWorkflowSource {
  if (item.scanKey) return "scan-finding";
  if (item.description?.startsWith("External opportunity signal from ")) {
    return "external-opportunity";
  }
  return "post-scan-issue";
}

export function startSolutionWorkflow(product: Product, item: Item): SolutionWorkflow {
  const now = new Date().toISOString();
  const workflow: SolutionWorkflow = {
    schema: "ailhat.solution-workflow/v1",
    id: `${product.id}:${item.id}`,
    productId: product.id,
    productName: product.name,
    itemId: item.id,
    itemTitle: item.title,
    ...(item.scanKey ? { scanKey: item.scanKey } : {}),
    source: workflowSource(item),
    stage: "solution",
    createdAt: now,
    updatedAt: now,
  };
  const rest = loadSolutionWorkflows().filter((current) => current.id !== workflow.id);
  persist([workflow, ...rest]);
  return workflow;
}

export function setSolutionWorkflowStage(
  id: string,
  stage: SolutionWorkflowStage,
): SolutionWorkflow[] {
  const next = loadSolutionWorkflows().map((workflow) =>
    workflow.id === id
      ? { ...workflow, stage, updatedAt: new Date().toISOString() }
      : workflow,
  );
  return persist(next);
}

export function resolveWorkflowForItem(itemId: string): SolutionWorkflow[] {
  const workflow = loadSolutionWorkflows().find((current) => current.itemId === itemId);
  if (!workflow) return loadSolutionWorkflows();
  return setSolutionWorkflowStage(workflow.id, "resolved");
}

export function workflowsForProduct(productId: string): SolutionWorkflow[] {
  return loadSolutionWorkflows().filter((workflow) => workflow.productId === productId);
}

export function subscribeSolutionWorkflows(listener: () => void): () => void {
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
