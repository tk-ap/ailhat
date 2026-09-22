import { randomUUID } from "node:crypto";
import { sql } from "~/db";
import { migrateAuth, type AuthUser } from "~/lib/auth";
import { getAccountAccess } from "~/lib/access.server";
import { getPortfolioState } from "~/lib/db-portfolio";
import { migrateSandboxEnvironments } from "~/lib/sandbox-environments.server";
import type {
  SandboxExecution,
  SandboxExecutionBackendConnection,
  SandboxExecutionEnvironment,
  SandboxExecutionStatus,
} from "~/lib/sandbox-execution";

const MIGRATION = `CREATE TABLE IF NOT EXISTS agent_direct_sandbox_executions (
  id                     text        PRIMARY KEY,
  user_id                bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_key            text        NOT NULL,
  backend                text        NOT NULL DEFAULT 'agent-os',
  work_item              jsonb       NOT NULL,
  sandbox                 jsonb       NOT NULL,
  status                  text        NOT NULL DEFAULT 'queued',
  runtime_directive_id    text,
  runtime_task_id         text,
  governance              jsonb,
  outcome                 jsonb,
  evidence                jsonb       NOT NULL DEFAULT '[]'::jsonb,
  review                  jsonb,
  claimed_at              timestamptz,
  claim_expires_at         timestamptz,
  claim_generation         integer     NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_direct_sandbox_executions_user_idx
  ON agent_direct_sandbox_executions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_direct_sandbox_executions_queue_idx
  ON agent_direct_sandbox_executions(status, created_at ASC);
ALTER TABLE agent_direct_sandbox_executions
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;
ALTER TABLE agent_direct_sandbox_executions
  ADD COLUMN IF NOT EXISTS claim_generation integer NOT NULL DEFAULT 0;`;

const VALID_STATUSES = new Set<SandboxExecutionStatus>([
  "queued","claimed","routing","governance_unavailable","governance_denied",
  "governance_approval_required","route_failed","dispatched","running",
  "review","completed","failed","cancelled",
]);

function asJson(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asEvidence(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function mapRow(row: Record<string, unknown>): SandboxExecution {
  return {
    id: String(row.id),
    productId: String(row.product_key),
    backend: "agent-os",
    status: String(row.status) as SandboxExecutionStatus,
    workItem: asJson(row.work_item) ?? {},
    sandbox: (asJson(row.sandbox) ?? {}) as unknown as SandboxExecutionEnvironment,
    runtimeDirectiveId: row.runtime_directive_id ? String(row.runtime_directive_id) : null,
    runtimeTaskId: row.runtime_task_id ? String(row.runtime_task_id) : null,
    governance: asJson(row.governance),
    outcome: asJson(row.outcome),
    evidence: asEvidence(row.evidence),
    review: asJson(row.review),
    claimGeneration: Number(row.claim_generation ?? 0),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function sandboxExecutionBackendConnection(): SandboxExecutionBackendConnection {
  return {
    backend: "agent-os",
    configured: Boolean(process.env.AILHAT_AGENTOS_SYNC_TOKEN?.trim()),
    transport: "pull",
  };
}

export async function migrateSandboxExecutions(): Promise<void> {
  await migrateAuth();
  await migrateSandboxEnvironments();
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(MIGRATION);
}

async function ownedProduct(userId: number, productId: string): Promise<Record<string, unknown>> {
  const raw = await getPortfolioState(userId);
  const products = raw && typeof raw === "object"
    ? (raw as { products?: unknown }).products
    : null;
  if (!Array.isArray(products)) throw new Error("product_not_found");
  const product = products.find((item) =>
    item && typeof item === "object" && String((item as { id?: unknown }).id ?? "") === productId
  );
  if (!product || typeof product !== "object") throw new Error("product_not_found");
  return product as Record<string, unknown>;
}

async function stableSandbox(userId: number, productId: string): Promise<SandboxExecutionEnvironment> {
  const rows = await sql()`select slug,sandbox_url,lifecycle,current_version_id,source_repository,source_ref,verification_state
    from product_sandbox_environments
    where user_id=${userId} and product_key=${productId} and provider='here-now'
    order by updated_at desc limit 1`;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row || String(row.lifecycle) !== "live") throw new Error("sandbox_not_ready");
  return {
    provider: "here-now",
    sandboxUrl: String(row.sandbox_url),
    slug: row.slug ? String(row.slug) : null,
    currentVersionId: row.current_version_id ? String(row.current_version_id) : null,
    sourceRepository: row.source_repository ? String(row.source_repository) : null,
    sourceRef: row.source_ref ? String(row.source_ref) : null,
    lifecycle: String(row.lifecycle),
    verificationState: String(row.verification_state || "unknown"),
  };
}

export async function getSandboxExecutionOverview(user: AuthUser, productId: string) {
  const access = await getAccountAccess(user);
  if (!access.productAccess) throw new Error("product_access_required");
  await migrateSandboxExecutions();
  await ownedProduct(user.id, productId);
  let sandbox: SandboxExecutionEnvironment | null = null;
  try { sandbox = await stableSandbox(user.id, productId); } catch (error) {
    if (!(error instanceof Error) || error.message !== "sandbox_not_ready") throw error;
  }
  const rows = await sql()`select * from agent_direct_sandbox_executions
    where user_id=${user.id} and product_key=${productId}
    order by created_at desc limit 12`;
  return {
    connection: sandboxExecutionBackendConnection(),
    sandbox,
    executions: rows.map((row) => mapRow(row as Record<string, unknown>)),
  };
}

export async function createSandboxExecution(user: AuthUser, input: Record<string, unknown>): Promise<SandboxExecution> {
  const access = await getAccountAccess(user);
  if (!access.productAccess) throw new Error("product_access_required");
  if (!sandboxExecutionBackendConnection().configured) throw new Error("execution_backend_unconfigured");
  await migrateSandboxExecutions();

  const productId = String(input.productId || "").trim();
  if (!productId) throw new Error("product_id_required");
  await ownedProduct(user.id, productId);
  const workItem = asJson(input.workItem);
  if (!workItem || workItem.schema !== "ailhat.agent-direct.work-item/v1") throw new Error("invalid_work_item");
  const workspace = asJson(workItem.workspace);
  if (!workspace || String(workspace.id || "") !== productId) throw new Error("work_item_product_mismatch");

  const sandbox = await stableSandbox(user.id, productId);
  const id = `agent-direct:${randomUUID()}`;
  const rows = await sql()`insert into agent_direct_sandbox_executions
    (id,user_id,product_key,backend,work_item,sandbox,status)
    values (
      ${id},${user.id},${productId},'agent-os',
      ${JSON.stringify(workItem)}::jsonb,${JSON.stringify(sandbox)}::jsonb,'queued'
    ) returning *`;
  return mapRow(rows[0] as Record<string, unknown>);
}

export async function claimNextSandboxExecution(): Promise<SandboxExecution | null> {
  await migrateSandboxExecutions();
  const rows = await sql()`with candidate as (
      select id from agent_direct_sandbox_executions
      where status='queued'
         or (status='claimed' and claim_expires_at < now())
      order by created_at asc
      for update skip locked
      limit 1
    )
    update agent_direct_sandbox_executions e
       set status='claimed',
           claimed_at=now(),
           claim_expires_at=now() + interval '5 minutes',
           claim_generation=e.claim_generation + 1,
           updated_at=now()
      from candidate
     where e.id=candidate.id
     returning e.*`;
  return rows[0] ? mapRow(rows[0] as Record<string, unknown>) : null;
}

export async function updateSandboxExecutionFromRuntime(input: Record<string, unknown>): Promise<SandboxExecution> {
  await migrateSandboxExecutions();
  const id = String(input.id || "").trim();
  const status = String(input.status || "").trim() as SandboxExecutionStatus;
  if (!id || !VALID_STATUSES.has(status)) throw new Error("invalid_runtime_update");
  const currentRows = await sql()`select * from agent_direct_sandbox_executions where id=${id} limit 1`;
  const current = currentRows[0] as Record<string, unknown> | undefined;
  if (!current) throw new Error("execution_not_found");
  if (String(current.status) === "claimed") {
    const observedGeneration = Number(input.claimGeneration ?? 0);
    const canonicalGeneration = Number(current.claim_generation ?? 0);
    if (!observedGeneration || observedGeneration !== canonicalGeneration) {
      throw new Error("stale_execution_claim");
    }
  }

  const runtimeDirectiveId = input.runtimeDirectiveId === undefined
    ? current.runtime_directive_id
    : (String(input.runtimeDirectiveId || "").trim() || null);
  const runtimeTaskId = input.runtimeTaskId === undefined
    ? current.runtime_task_id
    : (String(input.runtimeTaskId || "").trim() || null);
  const governance = input.governance === undefined ? current.governance : asJson(input.governance);
  const outcome = input.outcome === undefined ? current.outcome : asJson(input.outcome);
  const evidence = input.evidence === undefined ? asEvidence(current.evidence) : asEvidence(input.evidence);
  const review = input.review === undefined ? current.review : asJson(input.review);

  const rows = await sql()`update agent_direct_sandbox_executions
    set status=${status},
        runtime_directive_id=${runtimeDirectiveId ? String(runtimeDirectiveId) : null},
        runtime_task_id=${runtimeTaskId ? String(runtimeTaskId) : null},
        governance=${governance ? JSON.stringify(governance) : null}::jsonb,
        outcome=${outcome ? JSON.stringify(outcome) : null}::jsonb,
        evidence=${JSON.stringify(evidence)}::jsonb,
        review=${review ? JSON.stringify(review) : null}::jsonb,
        claim_expires_at=case when ${status}='claimed' then claim_expires_at else null end,
        updated_at=now()
    where id=${id}
    returning *`;
  return mapRow(rows[0] as Record<string, unknown>);
}
