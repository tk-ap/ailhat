import { sql } from "~/db";
import { migrateAuth, type AuthUser } from "~/lib/auth";
import { isPlatformOwner } from "~/lib/access.server";

const MIGRATION = `CREATE TABLE IF NOT EXISTS product_sandbox_environments (
  user_id                 bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_key             text        NOT NULL,
  provider                text        NOT NULL DEFAULT 'here-now',
  provider_connection_ref text        NOT NULL DEFAULT 'owner:provider:here-now',
  slug                     text,
  sandbox_url              text        NOT NULL,
  lifecycle                text        NOT NULL DEFAULT 'configured',
  static_primary           boolean     NOT NULL DEFAULT true,
  current_version_id       text,
  source_repository        text,
  source_ref               text,
  verification_state       text        NOT NULL DEFAULT 'unknown',
  verified_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_key, provider)
);

CREATE INDEX IF NOT EXISTS product_sandbox_environments_user_provider_idx
  ON product_sandbox_environments(user_id, provider, updated_at DESC);
`;

export type SandboxLifecycle = "unassigned" | "configured" | "live" | "stale" | "unavailable" | "retired";
export type VerificationState = "unknown" | "pending" | "passed" | "failed";

export interface ProductSandboxEnvironment {
  productId: string;
  provider: "here-now";
  providerConnectionRef: "owner:provider:here-now";
  slug: string | null;
  sandboxUrl: string;
  lifecycle: SandboxLifecycle;
  staticPrimary: boolean;
  currentVersionId: string | null;
  sourceRepository: string | null;
  sourceRef: string | null;
  verificationState: VerificationState;
  verifiedAt: string | null;
  updatedAt: string;
}

export interface SandboxProviderConnection {
  provider: "here-now";
  configured: boolean;
  source: "runtime_secret";
  secretName: "HERENOW_API_KEY";
  inherited: true;
}

function normalizeProductKey(value: string): string {
  const key = String(value || "").trim();
  if (!key || key.length > 128) throw new Error("invalid_product_id");
  return key;
}

function normalizeUrl(value: string): URL {
  let url: URL;
  try { url = new URL(String(value || "").trim()); }
  catch { throw new Error("invalid_sandbox_url"); }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("invalid_sandbox_url");
  if (!url.hostname.endsWith(".here.now")) throw new Error("invalid_here_now_url");
  url.hash = "";
  return url;
}

function normalizeOptional(value: unknown, max = 500): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function normalizeLifecycle(value: unknown): SandboxLifecycle {
  const v = String(value || "configured");
  if (!["unassigned","configured","live","stale","unavailable","retired"].includes(v)) throw new Error("invalid_lifecycle");
  return v as SandboxLifecycle;
}

function normalizeVerification(value: unknown): VerificationState {
  const v = String(value || "unknown");
  if (!["unknown","pending","passed","failed"].includes(v)) throw new Error("invalid_verification_state");
  return v as VerificationState;
}

export async function migrateSandboxEnvironments(): Promise<void> {
  await migrateAuth();
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(MIGRATION);
}

function mapRow(row: Record<string, unknown>): ProductSandboxEnvironment {
  return {
    productId: String(row.product_key),
    provider: "here-now",
    providerConnectionRef: "owner:provider:here-now",
    slug: row.slug ? String(row.slug) : null,
    sandboxUrl: String(row.sandbox_url),
    lifecycle: String(row.lifecycle) as SandboxLifecycle,
    staticPrimary: Boolean(row.static_primary),
    currentVersionId: row.current_version_id ? String(row.current_version_id) : null,
    sourceRepository: row.source_repository ? String(row.source_repository) : null,
    sourceRef: row.source_ref ? String(row.source_ref) : null,
    verificationState: String(row.verification_state) as VerificationState,
    verifiedAt: row.verified_at ? new Date(String(row.verified_at)).toISOString() : null,
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

export function hereNowOwnerConnection(): SandboxProviderConnection {
  return {
    provider: "here-now",
    configured: Boolean(process.env.HERENOW_API_KEY?.trim()),
    source: "runtime_secret",
    secretName: "HERENOW_API_KEY",
    inherited: true,
  };
}

export async function getSandboxEnvironmentOverview(owner: AuthUser) {
  if (!(await isPlatformOwner(owner))) throw new Error("owner_required");
  await migrateSandboxEnvironments();
  const rows = await sql() `select * from product_sandbox_environments
    where user_id = ${owner.id} and provider = 'here-now'
    order by updated_at desc`;
  return {
    connection: hereNowOwnerConnection(),
    environments: rows.map((row) => mapRow(row as Record<string, unknown>)),
  };
}

export async function saveProductSandboxEnvironment(owner: AuthUser, input: Record<string, unknown>) {
  if (!(await isPlatformOwner(owner))) throw new Error("owner_required");
  await migrateSandboxEnvironments();

  const productId = normalizeProductKey(String(input.productId || ""));
  const url = normalizeUrl(String(input.sandboxUrl || ""));
  const inferredSlug = url.hostname.slice(0, -".here.now".length);
  const slug = normalizeOptional(input.slug, 180) || inferredSlug;
  if (!/^[a-z0-9][a-z0-9-]{1,178}[a-z0-9]$/.test(slug)) throw new Error("invalid_sandbox_slug");

  const lifecycle = normalizeLifecycle(input.lifecycle);
  const verificationState = normalizeVerification(input.verificationState);
  const currentVersionId = normalizeOptional(input.currentVersionId, 250);
  const sourceRepository = normalizeOptional(input.sourceRepository, 250);
  const sourceRef = normalizeOptional(input.sourceRef, 250);
  const verifiedAt = verificationState === "passed" && input.verifiedAt
    ? new Date(String(input.verifiedAt))
    : null;
  if (verifiedAt && Number.isNaN(verifiedAt.getTime())) throw new Error("invalid_verified_at");

  const rows = await sql() `insert into product_sandbox_environments (
      user_id, product_key, provider, provider_connection_ref, slug, sandbox_url,
      lifecycle, static_primary, current_version_id, source_repository, source_ref,
      verification_state, verified_at, updated_at
    ) values (
      ${owner.id}, ${productId}, 'here-now', 'owner:provider:here-now', ${slug}, ${url.toString()},
      ${lifecycle}, true, ${currentVersionId}, ${sourceRepository}, ${sourceRef},
      ${verificationState}, ${verifiedAt ? verifiedAt.toISOString() : null}, now()
    )
    on conflict (user_id, product_key, provider) do update set
      provider_connection_ref = excluded.provider_connection_ref,
      slug = excluded.slug,
      sandbox_url = excluded.sandbox_url,
      lifecycle = excluded.lifecycle,
      static_primary = excluded.static_primary,
      current_version_id = excluded.current_version_id,
      source_repository = excluded.source_repository,
      source_ref = excluded.source_ref,
      verification_state = excluded.verification_state,
      verified_at = excluded.verified_at,
      updated_at = now()
    returning *`;
  return mapRow(rows[0] as Record<string, unknown>);
}

export async function deleteProductSandboxEnvironment(owner: AuthUser, productId: string) {
  if (!(await isPlatformOwner(owner))) throw new Error("owner_required");
  await migrateSandboxEnvironments();
  const key = normalizeProductKey(productId);
  await sql() `delete from product_sandbox_environments
    where user_id = ${owner.id} and product_key = ${key} and provider = 'here-now'`;
}
