import { createHash, randomBytes } from "node:crypto";
import { sql } from "~/db";
import { migrateAuth, type AuthUser } from "./auth";
import { migrateIntent } from "./db-intent";
import { migratePortfolio } from "./db-portfolio";
import { activeFoundingBeta, productAccessAllowed } from "./access-policy";

export const DEFAULT_BETA_ACCESS_DAYS = 45;
export const DEFAULT_INVITE_DAYS = 7;

export interface AccountAccess {
  role: "owner" | "customer";
  planKey: string;
  planStatus: string;
  foundingBeta: boolean;
  betaExpiresAt: string | null;
  productAccess: boolean;
  accessReason: "owner" | "founding_beta" | "beta_expired_or_not_granted";
}

const PLAN_SCHEMA = `CREATE TABLE IF NOT EXISTS account_plans (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_key text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  source text NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
)`;
const INVITE_SCHEMA = `CREATE TABLE IF NOT EXISTS founding_beta_invites (
  id bigserial PRIMARY KEY,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  access_days integer NOT NULL DEFAULT 45,
  created_by bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by bigint REFERENCES users(id) ON DELETE SET NULL,
  revoked_at timestamptz
)`;
const BETA_SCHEMA = `CREATE TABLE IF NOT EXISTS founding_beta_access (
  user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  source text NOT NULL DEFAULT 'invite'
)`;
const FEEDBACK_SCHEMA = `CREATE TABLE IF NOT EXISTS beta_feedback (
  id bigserial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,
  message text NOT NULL,
  route text,
  created_at timestamptz NOT NULL DEFAULT now()
)`;
const INVITE_INDEX = `CREATE INDEX IF NOT EXISTS founding_beta_invites_email_idx ON founding_beta_invites(lower(email), created_at DESC)`;
const FEEDBACK_INDEX = `CREATE INDEX IF NOT EXISTS beta_feedback_user_created_idx ON beta_feedback(user_id, created_at DESC)`;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function migrateAccess(): Promise<void> {
  await migrateAuth();
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(PLAN_SCHEMA);
  await q.query(INVITE_SCHEMA);
  await q.query(BETA_SCHEMA);
  await q.query(FEEDBACK_SCHEMA);
  await q.query(INVITE_INDEX);
  await q.query(FEEDBACK_INDEX);
}

export async function isPlatformOwner(user: AuthUser): Promise<boolean> {
  const configured = process.env.AILHAT_OWNER_EMAIL?.trim().toLowerCase();
  if (configured) return normalizeEmail(user.email) === configured;
  await migrateAuth();
  const rows = await sql()`select id from users order by id asc limit 1`;
  return rows.length > 0 && Number((rows[0] as { id: number }).id) === user.id;
}

async function ensurePlan(userId: number): Promise<void> {
  await migrateAccess();
  await sql()`insert into account_plans (user_id, plan_key, status, source)
    values (${userId}, 'free', 'active', 'internal') on conflict (user_id) do nothing`;
}

export async function getAccountAccess(user: AuthUser): Promise<AccountAccess> {
  await ensurePlan(user.id);
  const owner = await isPlatformOwner(user);
  const role = owner ? "owner" as const : "customer" as const;
  const planRows = await sql()`select plan_key, status from account_plans where user_id = ${user.id} limit 1`;
  const betaRows = await sql()`select expires_at, revoked_at from founding_beta_access where user_id = ${user.id} limit 1`;
  const plan = planRows[0] as { plan_key: string; status: string } | undefined;
  const beta = betaRows[0] as { expires_at: unknown; revoked_at: unknown } | undefined;
  const betaExpiresAt = beta?.expires_at ? new Date(String(beta.expires_at)).toISOString() : null;
  const betaRevokedAt = beta?.revoked_at ? new Date(String(beta.revoked_at)).toISOString() : null;
  const foundingBeta = activeFoundingBeta({ role, betaExpiresAt, betaRevokedAt });
  const productAccess = productAccessAllowed({ role, betaExpiresAt, betaRevokedAt });
  return {
    role,
    planKey: plan?.plan_key ?? "free",
    planStatus: plan?.status ?? "active",
    foundingBeta,
    betaExpiresAt,
    productAccess,
    accessReason: owner ? "owner" : foundingBeta ? "founding_beta" : "beta_expired_or_not_granted",
  };
}

export function betaInvitesEnabled(): boolean {
  return process.env.AILHAT_BETA_INVITES_ENABLED === "true";
}

export async function createFoundingBetaInvite(
  owner: AuthUser,
  email: string,
  accessDays = DEFAULT_BETA_ACCESS_DAYS,
  inviteDays = DEFAULT_INVITE_DAYS,
): Promise<{ token: string; email: string; expiresAt: string; accessDays: number }> {
  if (!(await isPlatformOwner(owner))) throw new Error("owner_required");
  if (!betaInvitesEnabled()) throw new Error("beta_invites_disabled");
  await migrateAccess();
  const normalized = normalizeEmail(email);
  if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("valid_email_required");
  const boundedAccessDays = Math.max(1, Math.min(180, Math.floor(accessDays || DEFAULT_BETA_ACCESS_DAYS)));
  const boundedInviteDays = Math.max(1, Math.min(30, Math.floor(inviteDays || DEFAULT_INVITE_DAYS)));
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + boundedInviteDays * 86_400_000);
  await sql()`insert into founding_beta_invites (email, token_hash, access_days, created_by, expires_at)
    values (${normalized}, ${sha256(token)}, ${boundedAccessDays}, ${owner.id}, ${expiresAt})`;
  return { token, email: normalized, expiresAt: expiresAt.toISOString(), accessDays: boundedAccessDays };
}

export async function createInvitedBetaUser(token: string, email: string, passwordHash: string): Promise<AuthUser | null> {
  if (!token || !betaInvitesEnabled()) return null;
  await migrateAccess();
  const normalized = normalizeEmail(email);
  const rows = await sql()`
    with claimed as (
      update founding_beta_invites set redeemed_at = now()
       where token_hash = ${sha256(token)} and lower(email) = lower(${normalized})
         and expires_at > now() and redeemed_at is null and revoked_at is null
       returning id, access_days
    ), created as (
      insert into users (email, password_hash)
      select ${normalized}, ${passwordHash} from claimed
      returning id, email
    ), marked as (
      update founding_beta_invites set redeemed_by = (select id from created)
       where id = (select id from claimed)
    ), granted as (
      insert into founding_beta_access (user_id, expires_at, source)
      select created.id, now() + claimed.access_days * interval '1 day', 'invite'
        from created cross join claimed
      returning user_id
    ), planned as (
      insert into account_plans (user_id, plan_key, status, source)
      select user_id, 'free', 'active', 'founding_beta' from granted
      on conflict (user_id) do nothing
    )
    select id, email from created
  `;
  if (!rows.length) return null;
  const row = rows[0] as { id: number; email: string };
  return { id: Number(row.id), email: row.email };
}

export async function revokeFoundingBeta(owner: AuthUser, userId: number): Promise<void> {
  if (!(await isPlatformOwner(owner))) throw new Error("owner_required");
  await migrateAccess();
  await sql()`update founding_beta_access set revoked_at = now() where user_id = ${userId}`;
}

export async function submitBetaFeedback(user: AuthUser, input: { category: string; message: string; route?: string | null }): Promise<void> {
  const access = await getAccountAccess(user);
  if (!access.productAccess) throw new Error("product_access_required");
  const category = String(input.category || "observation").trim().slice(0, 80) || "observation";
  const message = String(input.message || "").trim().slice(0, 5000);
  const route = input.route ? String(input.route).trim().slice(0, 500) : null;
  if (!message) throw new Error("feedback_required");
  await sql()`insert into beta_feedback (user_id, category, message, route)
    values (${user.id}, ${category}, ${message}, ${route})`;
}

export async function getOwnerOverview(owner: AuthUser) {
  if (!(await isPlatformOwner(owner))) throw new Error("owner_required");
  await migrateAccess();
  await migrateIntent();
  await migratePortfolio();
  const counts = await sql()`select
    (select count(*)::int from users) as users,
    (select count(*)::int from founding_beta_access where revoked_at is null and expires_at > now()) as active_beta,
    (select count(*)::int from founding_beta_invites where redeemed_at is null and revoked_at is null and expires_at > now()) as open_invites,
    (select count(*)::int from beta_feedback) as feedback_count,
    (select count(*)::int from intent_signups) as waitlist_count,
    (select coalesce(sum(jsonb_array_length(coalesce(state->'products', '[]'::jsonb))), 0)::int from portfolio_state) as active_products`;
  const c = counts[0] as Record<string, number>;
  const members = await sql()`select u.id as user_id, u.email, b.expires_at, b.revoked_at,
      coalesce(p.plan_key, 'free') as plan_key, ps.updated_at as portfolio_updated_at,
      coalesce(jsonb_array_length(coalesce(ps.state->'products', '[]'::jsonb)), 0)::int as active_products,
      coalesce((select count(*)::int from beta_feedback bf where bf.user_id = u.id), 0)::int as feedback_count
    from founding_beta_access b join users u on u.id = b.user_id
    left join account_plans p on p.user_id = u.id left join portfolio_state ps on ps.user_id = u.id
    order by b.granted_at desc`;
  const feedback = await sql()`select bf.id, u.email, bf.category, bf.message, bf.route, bf.created_at
    from beta_feedback bf join users u on u.id = bf.user_id order by bf.created_at desc limit 30`;
  const invites = await sql()`select id, email, access_days, expires_at, redeemed_at, revoked_at
    from founding_beta_invites order by created_at desc limit 30`;
  return {
    users: Number(c.users ?? 0), activeFoundingBeta: Number(c.active_beta ?? 0), openInvites: Number(c.open_invites ?? 0),
    feedbackCount: Number(c.feedback_count ?? 0), waitlistCount: Number(c.waitlist_count ?? 0), activePortfolioProducts: Number(c.active_products ?? 0),
    invitesEnabled: betaInvitesEnabled(), members, recentFeedback: feedback, invites,
  };
}
