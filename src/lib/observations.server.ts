// Server-only persistence for live availability observations (Agent Direct feed).
//
// PRIMARY store is Postgres (Neon). A plain JSON file under data/ was the old
// store — but Vercel's serverless filesystem is ephemeral, so observations
// written by POST /api/availability were lost between invocations (GET returned
// []). Moving to Postgres makes the feed durable across cold starts.
//
// The JSON file is kept ONLY as a fallback for the common cases where a database
// isn't reachable: local dev without DATABASE_URL, and the SSR build step. When
// the DB is available it is authoritative; reads/writes fall back to the file
// defensively so a DB hiccup never crashes a request.
//
// This module uses Node/Bun server APIs and runs only server-side (imported from
// the REST router, which only runs in serve.ts / vercel-entry.ts).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "~/db";
import type { AvailabilityObservation } from "./observations";

export const DATA_DIR = join(process.cwd(), "data");
export const DATA_FILE = join(DATA_DIR, "availability.json");

/** Keep at most this many observations per provider+url key (file fallback only). */
const MAX_PER_KEY = 5;

function dbAvailable(): boolean {
  return !!process.env.DATABASE_URL;
}

// ---- File fallback (used only when the DB is unavailable / a query fails) ----

function load(): AvailabilityObservation[] {
  try {
    const raw = readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(obs: AvailabilityObservation[]): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(obs, null, 2), "utf8");
}

function fileUpsert(obs: AvailabilityObservation): void {
  const all = load();
  const key = `${obs.provider}:${obs.url}`;
  const rest = all.filter((o) => `${o.provider}:${o.url}` !== key);
  const keyed = load()
    .filter((o) => `${o.provider}:${o.url}` === key)
    .concat(obs)
    .slice(-MAX_PER_KEY);
  save([...rest, ...keyed]);
}

function fileRead({ sinceMs }: { sinceMs: number }): AvailabilityObservation[] {
  const all = load();
  return sinceMs > 0
    ? all.filter((o) => typeof o.observedAt === "number" && o.observedAt >= sinceMs)
    : all;
}

// ---- Postgres mapping ----

interface ObservationRow {
  provider: string | null;
  url: string | null;
  cap: string | number | null;
  next: string | number | null;
  title: string | null;
  method: string | null;
  confidence: string | null;
  account: string | null;
  iface: string | null;
  id_field: string | null;
  use_note: string | null;
  observed_at: Date | string | number | null;
}

/**
 * Normalize a DB row into the extension payload shape the UI expects. The Neon
 * driver may return `numeric` columns as strings, and `timestamptz` as a Date;
 * coerce both back to the original number-shape payload (`cap`/`next` as numbers,
 * `observedAt` as an epoch-ms number) the way the old file store did.
 */
function rowToObservation(row: unknown): AvailabilityObservation {
  const r = (row ?? {}) as ObservationRow;
  const observedAt =
    r.observed_at instanceof Date
      ? r.observed_at.getTime()
      : typeof r.observed_at === "number"
        ? r.observed_at
        : typeof r.observed_at === "string"
          ? Date.parse(r.observed_at)
          : NaN;
  const num = (v: string | number | null): number | null | undefined => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    provider: r.provider,
    url: r.url,
    cap: num(r.cap),
    next: num(r.next),
    title: r.title,
    method: r.method,
    confidence: r.confidence,
    account: r.account,
    iface: r.iface,
    id: r.id_field,
    use: r.use_note,
    observedAt: Number.isFinite(observedAt) ? observedAt : undefined,
  };
}

/**
 * Read stored observations (oldest-first, matching the previous file store).
 * `sinceMs` filters to rows observed at/after that epoch-ms timestamp. Never
 * throws — falls back to the JSON file when the DB is unavailable or a query fails.
 */
export async function readObservations(opts?: {
  sinceMs?: number;
}): Promise<AvailabilityObservation[]> {
  const sinceMs = opts?.sinceMs ?? 0;
  if (!dbAvailable()) return fileRead({ sinceMs });
  try {
    const rows = sinceMs > 0
      ? await sql()`select provider, url, cap, next, title, method, confidence, account, iface, id_field, use_note, observed_at from availability_observations where observed_at >= to_timestamp(${sinceMs / 1000}) order by observed_at asc`
      : await sql()`select provider, url, cap, next, title, method, confidence, account, iface, id_field, use_note, observed_at from availability_observations order by observed_at asc`;
    return (rows as unknown[]).map(rowToObservation);
  } catch (err) {
    console.error("[observations] DB read failed, falling back to file:", err);
    return fileRead({ sinceMs });
  }
}

/**
 * Upsert an observation by (provider, url), keeping the newest row per key. Never
 * throws — falls back to the JSON file when the DB is unavailable or a query fails.
 */
export async function upsertObservation(
  obs: AvailabilityObservation,
): Promise<void> {
  if (!dbAvailable()) {
    try {
      fileUpsert(obs);
    } catch {
      // Never crash the request on a storage failure.
    }
    return;
  }
  try {
    await sql()`
      insert into availability_observations (
        provider, url, cap, next, title, method, confidence,
        account, iface, id_field, use_note, observed_at, received_at
      ) values (
        ${obs.provider ?? null}, ${obs.url ?? null}, ${obs.cap ?? null},
        ${obs.next ?? null}, ${obs.title ?? null}, ${obs.method ?? null},
        ${obs.confidence ?? null}, ${obs.account ?? null}, ${obs.iface ?? null},
        ${obs.id ?? null}, ${obs.use ?? null},
        ${obs.observedAt != null ? new Date(obs.observedAt) : new Date()}, now()
      )
      on conflict (provider, url)
      do update set
        cap = excluded.cap,
        next = excluded.next,
        title = excluded.title,
        method = excluded.method,
        confidence = excluded.confidence,
        account = excluded.account,
        iface = excluded.iface,
        id_field = excluded.id_field,
        use_note = excluded.use_note,
        observed_at = excluded.observed_at,
        received_at = excluded.received_at
    `;
  } catch (err) {
    console.error("[observations] DB upsert failed, falling back to file:", err);
    try {
      fileUpsert(obs);
    } catch {
      // Never crash the request on a storage failure.
    }
  }
}
