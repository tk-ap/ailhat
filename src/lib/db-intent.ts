// Intent-capture persistence for Ailhat. Server-only: this module is imported
// from the plain REST route in serve.ts (never from client code) and uses the
// built-in `~/db` helper, which resolves `DATABASE_URL` lazily so the site
// still builds and serves before a database is connected. `sql()` only throws
// if a query actually runs without `DATABASE_URL` set.

import { sql } from "~/db";

// Idempotent — safe to run any number of times. Mitigates the case where the
// first connection races the first insert (CREATE TABLE + INSERT are two
// separate round-trips), and lets us re-migrate a fresh DB without harm.
const MIGRATION = `
CREATE TABLE IF NOT EXISTS intent_signups (
  id            bigserial PRIMARY KEY,
  product_count integer     NOT NULL,
  platforms     text        NOT NULL,
  email         text,
  pain_waitlist boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
`;

export type IntentSignupInput = {
  email?: string | null;
  productCount: number;
  platforms: string;
  painWaitlist: boolean;
};

export type IntentRow = {
  id: number;
  product_count: number;
  platforms: string;
  email: string | null;
  pain_waitlist: boolean;
  created_at: string;
};

/** Apply the schema. Safe to call repeatedly. */
export async function migrateIntent(): Promise<void> {
  // Run the DDL via `sql.query` with NO bind parameters (neon rejects DDL when
  // values are interpolated as $1 params, and the driver's tagged-template form
  // does exactly that for non-literal SQL). `sql.query` executes the raw string
  // literally, which is correct for CREATE TABLE.
  const q = sql() as unknown as {
    query: (text: string) => Promise<unknown>;
  };
  await q.query(MIGRATION);
}

/** Insert one intent signup (after migrating) and return its id. */
export async function saveIntentSignup(
  input: IntentSignupInput,
): Promise<{ id: number }> {
  // Ensure the table exists even if the caller skipped migrateIntent().
  await migrateIntent();
  const rows = await sql()`
    insert into intent_signups (product_count, platforms, email, pain_waitlist)
    values (
      ${input.productCount},
      ${input.platforms},
      ${input.email && input.email.length > 0 ? input.email : null},
      ${input.painWaitlist}
    )
    returning id
  `;
  const row = rows[0] as { id: number };
  return { id: row.id };
}

// ---- Server-side input validation/coercion (pure) ----

export type IntentInputResult =
  | { ok: true; value: IntentSignupInput }
  | { ok: false; error: string; status: number };

const MAX_PLATFORMS_LEN = 400; // comma-separated list, generous but bounded
const MAX_EMAIL_LEN = 254; // RFC 5321 practical limit
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Coerce a raw (untrusted) JSON body into a validated IntentSignupInput.
 * Numbers, booleans and strings are coerced server-side; malformed values are
 * rejected with a user-facing message rather than blindly persisted.
 */
export function validateIntentInput(raw: unknown): IntentInputResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, status: 400, error: "Invalid request body." };
  }
  const r = raw as Record<string, unknown>;

  // productCount — number/select, expect an integer in a sane range.
  const productCount = Number(r.productCount);
  if (!Number.isFinite(productCount) || !Number.isInteger(productCount)) {
    return { ok: false, status: 400, error: "Please enter how many products you run." };
  }
  if (productCount < 1 || productCount > 10000) {
    return { ok: false, status: 400, error: "Product count must be between 1 and 10000." };
  }

  // platforms — comma-separated string; keep raw text but bound its length.
  const platforms = String(r.platforms ?? "").trim();
  if (!platforms) {
    return { ok: false, status: 400, error: "Please select at least one platform." };
  }
  if (platforms.length > MAX_PLATFORMS_LEN) {
    return { ok: false, status: 400, error: "Platform list is too long." };
  }

  // email — optional, but if present must look like one.
  const emailRaw = r.email;
  let email: string | null = null;
  if (emailRaw !== undefined && emailRaw !== null && emailRaw !== "") {
    const s = String(emailRaw).trim();
    if (s.length > MAX_EMAIL_LEN || !EMAIL_RE.test(s)) {
      return { ok: false, status: 400, error: "That email address doesn't look right." };
    }
    email = s;
  }

  // painWaitlist — boolean or "1"/"0"/"true"/"false"; anything truthy-like.
  let painWaitlist: boolean;
  if (typeof r.painWaitlist === "boolean") {
    painWaitlist = r.painWaitlist;
  } else {
    painWaitlist = ["1", "true", "yes", "on"].includes(
      String(r.painWaitlist).toLowerCase(),
    );
  }

  return { ok: true, value: { email, productCount, platforms, painWaitlist } };
}

/** Query rows back (used for testing the round trip when a DB is available). */
export async function listIntentSignups(
  limit = 50,
): Promise<IntentRow[]> {
  const rows = await sql()`select * from intent_signups order by id desc limit ${limit}`;
  return (rows as unknown as IntentRow[]).map((r) => ({
    ...r,
    created_at: String(r.created_at),
  }));
}
