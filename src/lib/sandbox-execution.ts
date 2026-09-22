export type SandboxExecutionStatus =
  | "queued"
  | "claimed"
  | "routing"
  | "governance_unavailable"
  | "governance_denied"
  | "governance_approval_required"
  | "route_failed"
  | "dispatched"
  | "running"
  | "review"
  | "completed"
  | "failed"
  | "cancelled";

export interface SandboxExecutionBackendConnection {
  backend: "agent-os";
  configured: boolean;
  transport: "pull";
}

export interface SandboxExecutionEnvironment {
  provider: "here-now";
  sandboxUrl: string;
  slug: string | null;
  currentVersionId: string | null;
  sourceRepository: string | null;
  sourceRef: string | null;
  lifecycle: string;
  verificationState: string;
}

export interface SandboxExecution {
  id: string;
  productId: string;
  backend: "agent-os";
  status: SandboxExecutionStatus;
  workItem: Record<string, unknown>;
  sandbox: SandboxExecutionEnvironment;
  runtimeDirectiveId: string | null;
  runtimeTaskId: string | null;
  governance: Record<string, unknown> | null;
  outcome: Record<string, unknown> | null;
  evidence: Array<Record<string, unknown>>;
  review: Record<string, unknown> | null;
  claimGeneration: number;
  createdAt: string;
  updatedAt: string;
}

export interface SandboxExecutionBackend {
  submit(input: {
    productId: string;
    workItem: Record<string, unknown>;
    sandbox: SandboxExecutionEnvironment;
  }): Promise<SandboxExecution>;
  status(executionId: string): Promise<SandboxExecution>;
  evidence(executionId: string): Promise<Array<Record<string, unknown>>>;
  decide?(reviewId: string, decision: string): Promise<unknown>;
}

export const ACTIVE_SANDBOX_EXECUTION_STATES = new Set<SandboxExecutionStatus>([
  "queued",
  "claimed",
  "routing",
  "governance_unavailable",
  "governance_approval_required",
  "dispatched",
  "running",
  "review",
]);
