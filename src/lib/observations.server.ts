// Server-only persistence for live availability observations (Agent Control feed).
//
// Stores observations in a lightweight JSON file under the workspace
// (data/availability.json). A plain file write is fine under `bun run publish`
// (the server keeps running) — no database needed for this slice. The path is
// resolved from process.cwd() (the workspace dir), NOT from the build output
// dir, so it survives `vite build` clearing dist/.
//
// This module uses Node/Bun server APIs; it must only ever run server-side
// (imported from the REST router, which only runs in serve.ts / vercel-entry.ts).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AvailabilityObservation } from "./observations";

export const DATA_DIR = join(process.cwd(), "data");
export const DATA_FILE = join(DATA_DIR, "availability.json");

/** Keep at most this many observations per provider+url key. */
const MAX_PER_KEY = 5;

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

export function readObservations(): AvailabilityObservation[] {
  return load();
}

/**
 * Append/upsert an observation: collapses to the most recent per provider+url,
 * keeping the last MAX_PER_KEY per key. Never throws on write errors.
 */
export function upsertObservation(obs: AvailabilityObservation): void {
  try {
    const all = load();
    const key = `${obs.provider}:${obs.url}`;
    const rest = all.filter((o) => `${o.provider}:${o.url}` !== key);
    const keyed = load()
      .filter((o) => `${o.provider}:${o.url}` === key)
      .concat(obs)
      .slice(-MAX_PER_KEY);
    save([...rest, ...keyed]);
  } catch {
    // Never crash the request on a storage failure.
  }
}

/** Newest observation per (provider+url) key, keyed by `<provider>:<url>`. */
export function latestByKey(): Map<string, AvailabilityObservation> {
  const byKey = new Map<string, AvailabilityObservation>();
  for (const o of load()) {
    const key = `${o.provider}:${o.url}`;
    const cur = byKey.get(key);
    if (
      !cur ||
      (typeof o.observedAt === "number" &&
        (typeof cur.observedAt !== "number" || o.observedAt > cur.observedAt))
    ) {
      byKey.set(key, o);
    }
  }
  return byKey;
}
