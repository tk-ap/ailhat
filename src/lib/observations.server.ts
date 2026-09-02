// Server-only persistence for Agent Direct availability / site-scan observations.
// Every durable read/write is scoped by authenticated user id. The legacy shared
// availability_observations table is intentionally not used by this module.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "~/db";
import type { AvailabilityObservation } from "./observations";

export const DATA_DIR = join(process.cwd(), "data");
const MAX_PER_KEY = 5;
const TABLE_MIGRATION = `CREATE TABLE IF NOT EXISTS tenant_availability_observations (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  url TEXT NOT NULL,
  cap NUMERIC,
  next NUMERIC,
  title TEXT,
  method TEXT,
  confidence TEXT,
  account TEXT,
  iface TEXT,
  id_field TEXT,
  use_note TEXT,
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider, url)
)`;
const INDEX_MIGRATION = `CREATE INDEX IF NOT EXISTS tenant_availability_user_observed_idx ON tenant_availability_observations(user_id, observed_at DESC)`;

function dbAvailable(): boolean { return !!process.env.DATABASE_URL; }
function tenantFile(userId: number): string { return join(DATA_DIR, `availability.user-${Math.max(0, Math.trunc(userId))}.json`); }
function loadFile(userId: number): AvailabilityObservation[] {
  try { const parsed = JSON.parse(readFileSync(tenantFile(userId), "utf8")); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function saveFile(userId: number, observations: AvailabilityObservation[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(tenantFile(userId), JSON.stringify(observations, null, 2), "utf8");
}
function fileUpsert(userId: number, obs: AvailabilityObservation): void {
  const all = loadFile(userId);
  const key = `${obs.provider}:${obs.url}`;
  const rest = all.filter((row) => `${row.provider}:${row.url}` !== key);
  const keyed = all.filter((row) => `${row.provider}:${row.url}` === key).concat(obs).slice(-MAX_PER_KEY);
  saveFile(userId, [...rest, ...keyed]);
}
async function ensureSchema(): Promise<void> {
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(TABLE_MIGRATION);
  await q.query(INDEX_MIGRATION);
}

interface ObservationRow {
  provider: string | null; url: string | null; cap: string | number | null; next: string | number | null;
  title: string | null; method: string | null; confidence: string | null; account: string | null;
  iface: string | null; id_field: string | null; use_note: string | null; observed_at: Date | string | number | null;
}
function rowToObservation(row: unknown): AvailabilityObservation {
  const r = (row ?? {}) as ObservationRow;
  const observedAt = r.observed_at instanceof Date ? r.observed_at.getTime() : typeof r.observed_at === "number" ? r.observed_at : typeof r.observed_at === "string" ? Date.parse(r.observed_at) : NaN;
  const num = (value: string | number | null): number | null => {
    if (value == null || value === "") return null;
    const n = Number(value); return Number.isFinite(n) ? n : null;
  };
  return { provider: r.provider, url: r.url, cap: num(r.cap), next: num(r.next), title: r.title, method: r.method,
    confidence: r.confidence, account: r.account, iface: r.iface, id: r.id_field, use: r.use_note,
    observedAt: Number.isFinite(observedAt) ? observedAt : undefined };
}

export async function readObservations(userId: number, opts?: { sinceMs?: number }): Promise<AvailabilityObservation[]> {
  const sinceMs = opts?.sinceMs ?? 0;
  if (!Number.isFinite(userId) || userId <= 0) return [];
  if (!dbAvailable()) {
    const rows = loadFile(userId);
    return sinceMs > 0 ? rows.filter((row) => (row.observedAt ?? 0) >= sinceMs) : rows;
  }
  try {
    await ensureSchema();
    const rows = sinceMs > 0
      ? await sql()`select provider, url, cap, next, title, method, confidence, account, iface, id_field, use_note, observed_at from tenant_availability_observations where user_id = ${userId} and observed_at >= to_timestamp(${sinceMs / 1000}) order by observed_at asc`
      : await sql()`select provider, url, cap, next, title, method, confidence, account, iface, id_field, use_note, observed_at from tenant_availability_observations where user_id = ${userId} order by observed_at asc`;
    return (rows as unknown[]).map(rowToObservation);
  } catch (error) {
    console.error("[observations] tenant DB read failed, falling back to tenant file:", error);
    const rows = loadFile(userId);
    return sinceMs > 0 ? rows.filter((row) => (row.observedAt ?? 0) >= sinceMs) : rows;
  }
}

export async function upsertObservation(userId: number, obs: AvailabilityObservation): Promise<void> {
  if (!Number.isFinite(userId) || userId <= 0) return;
  const scoped: AvailabilityObservation = { ...obs, account: String(userId) };
  if (!dbAvailable()) { try { fileUpsert(userId, scoped); } catch { /* best effort */ } return; }
  try {
    await ensureSchema();
    await sql()`insert into tenant_availability_observations (
      user_id, provider, url, cap, next, title, method, confidence, account, iface, id_field, use_note, observed_at, received_at
    ) values (
      ${userId}, ${scoped.provider ?? "unknown"}, ${scoped.url ?? ""}, ${scoped.cap ?? null}, ${scoped.next ?? null},
      ${scoped.title ?? null}, ${scoped.method ?? null}, ${scoped.confidence ?? null}, ${String(userId)}, ${scoped.iface ?? null},
      ${scoped.id ?? null}, ${scoped.use ?? null}, ${scoped.observedAt != null ? new Date(scoped.observedAt) : new Date()}, now()
    ) on conflict (user_id, provider, url) do update set
      cap = excluded.cap, next = excluded.next, title = excluded.title, method = excluded.method,
      confidence = excluded.confidence, account = excluded.account, iface = excluded.iface,
      id_field = excluded.id_field, use_note = excluded.use_note, observed_at = excluded.observed_at,
      received_at = excluded.received_at`;
  } catch (error) {
    console.error("[observations] tenant DB upsert failed, falling back to tenant file:", error);
    try { fileUpsert(userId, scoped); } catch { /* best effort */ }
  }
}
