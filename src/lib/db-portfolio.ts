// Per-user server-side persistence of the Ailhat portfolio state.
// Server-only: imported from serve.ts (never client code). Uses the lazy `~/db`
// helper so the site still builds/serves before a database is connected.
//
// The client stores the full dashboard AppState (products, items, scans,
// feedback) as a single JSON blob in a `portfolio_state` row keyed to the user,
// so state survives across browsers/devices and a cache clear. DDL runs via
// sql().query(raw) with NO bind params (the Neon driver rejects DDL with $params;
// the tagged-template form does that). Inserts/selects use the tagged-template.

import { sql } from "~/db";

const MIGRATION = `
CREATE TABLE IF NOT EXISTS portfolio_state (
  user_id    bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
`;

/** Apply the schema. Safe to call repeatedly. */
export async function migratePortfolio(): Promise<void> {
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(MIGRATION);
}

/**
 * Return the user's saved portfolio state, or null if they have none yet.
 * The jsonb is returned as a plain object (already parsed by the driver).
 */
export async function getPortfolioState(
  userId: number,
): Promise<unknown | null> {
  await migratePortfolio();
  const rows =
    await sql()`select state from portfolio_state where user_id = ${userId} limit 1`;
  if (rows.length === 0) return null;
  return (rows[0] as { state: unknown }).state;
}

/** Upsert the user's full portfolio state. */
export async function putPortfolioState(
  userId: number,
  state: unknown,
): Promise<void> {
  await migratePortfolio();
  await sql()`
    insert into portfolio_state (user_id, state, updated_at)
    values (${userId}, ${JSON.stringify(state)}, now())
    on conflict (user_id)
    do update set state = excluded.state, updated_at = now()
  `;
}
