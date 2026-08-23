// Owner authentication for Ailhat — self-hosted, server-only.
//
// This module is imported ONLY from serve.ts (the Bun fetch handler), never from
// client code. It uses the built-in `~/db` helper, which resolves DATABASE_URL
// lazily, so the site still builds and serves before a database is connected.
//
// Passwords are hashed with Node/Bun's built-in crypto.scrypt (strong KDF, no
// heavy dependency), stored as `scrypt$<saltHex>$<hashHex>`. Session tokens are
// random bytes stored only as a SHA-256 hash; the raw token goes to the client
// as an httpOnly, SameSite=Lax cookie. No plaintext passwords or raw tokens are
// ever persisted.

import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from "node:crypto";
import { sql } from "~/db";

// ---------------------------------------------------------------- schema ----

// Idempotent — safe to run any number of times (re-migrating a fresh DB is fine,
// and first-connection races are mitigated). DDL MUST run via sql().query(raw)
// with NO bind params (neon rejects DDL with $params; the tagged-template form
// does exactly that). The Neon HTTP driver also rejects MORE than one statement
// per call, so each CREATE TABLE is its own query. Inserts/selects below use the
// tagged-template form.
const MIGRATION_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id            bigserial PRIMARY KEY,
  email         text        NOT NULL UNIQUE,
  password_hash text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
`;
const MIGRATION_SESSIONS = `
CREATE TABLE IF NOT EXISTS sessions (
  id         bigserial PRIMARY KEY,
  token_hash text        NOT NULL UNIQUE,
  user_id    bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
`;

export type AuthUser = { id: number; email: string };

/** Apply the auth schema. Safe to call repeatedly. */
export async function migrateAuth(): Promise<void> {
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(MIGRATION_USERS);
  await q.query(MIGRATION_SESSIONS);
}

// ------------------------------------------------------- password hashing ----

const KEYLEN = 64;
const scryptAsync = (password: string, salt: Buffer, keylen: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    _scrypt(password, salt, keylen, (err, key) =>
      err ? reject(err) : resolve(key as Buffer),
    );
  });

/** Hash a password with a fresh random salt (scrypt). Returns scrypt$salt$hash. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time compare of a plaintext password against a stored hash. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await scryptAsync(password, salt, expected.length);
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

// --------------------------------------------------- session token helpers ----

export const SESSION_COOKIE = "sortie_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Generate a random session token (returned to the client raw). */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

// -------------------------------------------------------------- queries -----

/** Total number of users. Used to gate signup to the single-owner model. */
export async function countUsers(): Promise<number> {
  await migrateAuth();
  const rows = await sql()`select count(*)::int as n from users`;
  return (rows[0] as { n: number }).n;
}

/** Create a user (email unique). Throws if the email already exists. */
export async function createUser(
  email: string,
  passwordHash: string,
): Promise<AuthUser> {
  await migrateAuth();
  const rows = await sql()`
    insert into users (email, password_hash)
    values (${email}, ${passwordHash})
    returning id, email
  `;
  const r = rows[0] as { id: number; email: string };
  return { id: r.id, email: r.email };
}

/** Look up a user by email (for login). Returns null if not found. */
export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  await migrateAuth();
  const rows =
    await sql()`select id, email from users where lower(email) = lower(${email}) limit 1`;
  if (rows.length === 0) return null;
  const r = rows[0] as { id: number; email: string };
  return { id: r.id, email: r.email };
}

/** Fetch the stored password hash for a user (login verification). */
export async function getPasswordHash(userId: number): Promise<string | null> {
  await migrateAuth();
  const rows =
    await sql()`select password_hash from users where id = ${userId} limit 1`;
  return rows.length ? (rows[0] as { password_hash: string }).password_hash : null;
}

/**
 * Create a session for a user and return the raw token (store only its hash).
 */
export async function createSession(userId: number): Promise<string> {
  await migrateAuth();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await sql()`
    insert into sessions (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${userId}, ${expiresAt})
  `;
  return token;
}

/** Resolve a raw session token to its user, enforcing expiry. Null if invalid. */
export async function findUserByToken(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  await migrateAuth();
  const rows = await sql()`
    select u.id, u.email, s.expires_at
    from sessions s
    join users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)}
    limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as { id: number; email: string; expires_at: unknown };
  try {
    const exp = new Date(String(r.expires_at)).getTime();
    if (!Number.isFinite(exp) || exp < Date.now()) {
      // Expired — clear it lazily.
      await sql()`delete from sessions where token_hash = ${sha256(token)}`;
      return null;
    }
  } catch {
    return null;
  }
  return { id: r.id, email: r.email };
}

/** Delete a session (logout). */
export async function deleteSessionByToken(token: string): Promise<void> {
  if (!token) return;
  await migrateAuth();
  await sql()`delete from sessions where token_hash = ${sha256(token)}`;
}

// -------------------------------------------------------- input validation ---

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_EMAIL_LEN = 254;

export type AuthInputResult =
  | { ok: true; email: string; password: string }
  | { ok: false; error: string };

/** Coerce + validate a raw JSON signup/login body. */
export function validateAuthInput(raw: unknown): AuthInputResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Invalid request body." };
  }
  const r = raw as Record<string, unknown>;
  const email = String(r.email ?? "").trim().toLowerCase();
  const password = String(r.password ?? "");
  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
  }
  return { ok: true, email, password };
}

// ------------------------------------------------------------ cookie helpers --

/** Parse a Cookie header into a record. SSR-safe, no browser globals. */
export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}
