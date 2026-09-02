import { sql } from "~/db";
import type { RadarDisposition, RadarSignal, RadarSignalStatus } from "./radar";

const MIGRATION = `
CREATE TABLE IF NOT EXISTS radar_signals (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id text NOT NULL,
  signal jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS radar_signals_user_updated_idx ON radar_signals(user_id, updated_at DESC);
`;

async function ensureRadarSchema() {
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(MIGRATION);
}

export async function listRadarSignals(userId: number): Promise<RadarSignal[]> {
  await ensureRadarSchema();
  const rows = await sql()`select signal from radar_signals where user_id = ${userId} order by updated_at desc limit 200`;
  return rows.map((row) => (row as { signal: RadarSignal }).signal).filter(Boolean);
}

export async function putRadarSignal(userId: number, signal: RadarSignal): Promise<void> {
  await ensureRadarSchema();
  await sql()`
    insert into radar_signals (user_id, id, signal, created_at, updated_at)
    values (${userId}, ${signal.id}, ${JSON.stringify(signal)}, ${new Date(signal.createdAt)}, ${new Date(signal.updatedAt)})
    on conflict (user_id, id) do update set signal = excluded.signal, updated_at = excluded.updated_at
  `;
}

export async function updateRadarSignal(
  userId: number,
  id: string,
  patch: { ownerDisposition?: RadarDisposition | null; productId?: string | null; status?: RadarSignalStatus },
): Promise<RadarSignal | null> {
  const signals = await listRadarSignals(userId);
  const current = signals.find((signal) => signal.id === id);
  if (!current) return null;
  const next: RadarSignal = {
    ...current,
    ...(patch.ownerDisposition === null ? { ownerDisposition: undefined } : patch.ownerDisposition ? { ownerDisposition: patch.ownerDisposition } : {}),
    ...(patch.productId === null ? { productId: undefined } : patch.productId !== undefined ? { productId: patch.productId || undefined } : {}),
    ...(patch.status ? { status: patch.status } : {}),
    updatedAt: Date.now(),
  };
  await putRadarSignal(userId, next);
  return next;
}
