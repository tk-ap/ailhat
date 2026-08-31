import { createHash, randomBytes } from "node:crypto";
import { sql } from "~/db";
import { migrateAuth, type AuthUser } from "./auth";
import { migrateIntent } from "./db-intent";
import { migratePortfolio } from "./db-portfolio";

export const DEFAULT_OWNER_EMAIL = "tahlia.ashwood@gmail.com";
export const DEFAULT_BETA_ACCESS_DAYS = 45;
export const DEFAULT_INVITE_DAYS = 7;

export type AccountAccess = {
  role: "owner" | "customer";
  planKey: string;
  planStatus: string;
  foundingBeta: boolean;
  betaExpiresAt: string | null;
};

export type OwnerOverview = {
  users: number;
  activeFoundingBeta: number;
  openInvites: number;
  feedbackCount: number;
  waitlistCount: number;
  activePortfolioProducts: number;
  members: Array<{
    userId: number;
    email: string;
    planKey: string;
    betaExpiresAt: string;
    portfolioUpdatedAt: string | null;
    activeProducts: number;
    feedbackCount: number;
  }>;
  recentFeedback: Array<{
    id: number;
    email: string;
    category: string;
    message: string;
    route: string | null;
    createdAt: string;
  }>;
};

const PLAN_SCHEMA = `
CREATE TABLE IF NOT EXISTS account_plans (
  user_id     bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan_key    text        NOT NULL DEFAULT 'free',
  status      text        NOT NULL DEFAULT 'active',
  source      text        NOT NULL DEFAULT 'internal',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
`;

const BETA_INVITES_SCHEMA = `
CREATE TABLE IF NOT EXISTS founding_beta_invites (
  id           bigserial   PRIMARY KEY,
  email        text        NOT NULL,
  token_hash   text        NOT NULL UNIQUE,
  access_days  integer     NOT NULL DEFAULT 45,
  created_by   bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  redeemed_at  timestamptz,
  redeemed_by  bigint      REFERENCES users(id) ON DELETE SET NULL
);
`;

const BETA_ACCESS_SCHEMA = `
CREATE TABLE IF NOT EXISTS founding_beta_access (
  user_id     bigint      PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  granted_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  source      text        NOT NULL DEFAULT 'invite'
);
`;

const BETA_FEEDBACK_SCHEMA = `
CREATE TABLE IF NOT EXISTS beta_feedback (
  id          bigserial   PRIMARY KEY,
  user_id     bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    text        NOT NULL,
  message     text        NOT NULL,
  route       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
`;

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function ownerEmail(): string {
  return normalizeEmail(process.env.AILHAT_OWNER_EMAIL ?? DEFAULT_OWNER_EMAIL);
}

export function isOwnerEmail(email: string): boolean {
  return normalizeEmail(email) === ownerEmail();
}

export async function migrateAccess(): Promise<void> {
  await migrateAuth();
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(PLAN_SCHEMA);
  await q.query(BETA_INVITES_SCHEMA);
  await q.query(BETA_ACCESS_SCHEMA);
  await q.query(BETA_FEEDBACK_SCHEMA);
}

async function ensurePlan(userId: number): Promise<void> {
  await migrateAccess();
  await sql()`
    insert into account_plans (user_id, plan_key, status, source)
    values (${userId}, 'free', 'active', 'internal')
    on conflict (user_id) do nothing
  `;
}

export async function getAccountAccess(user: AuthUser): Promise<AccountAccess> {
  await ensurePlan(user.id);
  const planRows = await sql()`
    select plan_key, status from account_plans where user_id = ${user.id} limit 1
  `;
  const betaRows = await sql()`
    select expires_at
      from founding_beta_access
     where user_id = ${user.id} and expires_at > now()
     limit 1
  `;
  const plan = planRows[0] as { plan_key: string; status: string } | undefined;
  const beta = betaRows[0] as { expires_at: unknown } | undefined;
  return {
    role: isOwnerEmail(user.email) ? "owner" : "customer",
    planKey: plan?.plan_key ?? "free",
    planStatus: plan?.status ?? "active",
    foundingBeta: !!beta,
    betaExpiresAt: beta ? String(beta.expires_at) : null,
  };
}

export async function createFoundingBetaInvite(
  owner: AuthUser,
  email: string,
  accessDays = DEFAULT_BETA_ACCESS_DAYS,
  inviteDays = DEFAULT_INVITE_DAYS,
): Promise<{ token: string; email: string; expiresAt: string; accessDays: number }> {
  if (!isOwnerEmail(owner.email)) throw new Error("Owner access required.");
  await migrateAccess();
  const normalized = normalizeEmail(email);
  if (!normalized || !normalized.includes("@")) throw new Error("A valid email is required.");
  const boundedAccessDays = Math.max(1, Math.min(365, Math.floor(accessDays)));
  const boundedInviteDays = Math.max(1, Math.min(30, Math.floor(inviteDays)));
  const token = randomBytes(24).toString("base64url");
  const inviteExpiresAt = new Date(Date.now() + boundedInviteDays * 24 * 60 * 60 * 1000);
  await sql()`
    insert into founding_beta_invites (email, token_hash, access_days, created_by, expires_at)
    values (${normalized}, ${sha256(token)}, ${boundedAccessDays}, ${owner.id}, ${inviteExpiresAt})
  `;
  return {
    token,
    email: normalized,
    expiresAt: inviteExpiresAt.toISOString(),
    accessDays: boundedAccessDays,
  };
}

export async function redeemFoundingBetaInvite(
  token: string,
  email: string,
  userId: number,
): Promise<boolean> {
  if (!token) return false;
  await migrateAccess();
  const normalized = normalizeEmail(email);
  const rows = await sql()`
    select id, access_days
      from founding_beta_invites
     where token_hash = ${sha256(token)}
       and lower(email) = lower(${normalized})
       and expires_at > now()
       and redeemed_at is null
     limit 1
  `;
  if (rows.length === 0) return false;
  const invite = rows[0] as { id: number; access_days: number };
  const accessExpiresAt = new Date(Date.now() + invite.access_days * 24 * 60 * 60 * 1000);
  await sql()`
    insert into founding_beta_access (user_id, expires_at, source)
    values (${userId}, ${accessExpiresAt}, 'invite')
    on conflict (user_id)
    do update set expires_at = excluded.expires_at, granted_at = now(), source = 'invite'
  `;
  await ensurePlan(userId);
  await sql()`
    update founding_beta_invites
       set redeemed_at = now(), redeemed_by = ${userId}
     where id = ${invite.id}
  `;
  return true;
}

export async function revokeFoundingBeta(owner: AuthUser, userId: number): Promise<void> {
  if (!isOwnerEmail(owner.email)) throw new Error("Owner access required.");
  await migrateAccess();
  await sql()`delete from founding_beta_access where user_id = ${userId}`;
}

export async function submitBetaFeedback(
  user: AuthUser,
  input: { category: string; message: string; route?: string | null },
): Promise<void> {
  const access = await getAccountAccess(user);
  if (!access.foundingBeta && access.role !== "owner") {
    throw new Error("Founding Beta access required.");
  }
  const category = String(input.category || "observation").trim().slice(0, 80);
  const message = String(input.message || "").trim().slice(0, 5000);
  const route = input.route ? String(input.route).slice(0, 500) : null;
  if (!message) throw new Error("Feedback cannot be empty.");
  await sql()`
    insert into beta_feedback (user_id, category, message, route)
    values (${user.id}, ${category || "observation"}, ${message}, ${route})
  `;
}

export async function getOwnerOverview(owner: AuthUser): Promise<OwnerOverview> {
  if (!isOwnerEmail(owner.email)) throw new Error("Owner access required.");
  await migrateAccess();
  await migrateIntent();
  await migratePortfolio();

  const counts = await sql()`
    select
      (select count(*)::int from users) as users,
      (select count(*)::int from founding_beta_access where expires_at > now()) as active_beta,
      (select count(*)::int from founding_beta_invites where redeemed_at is null and expires_at > now()) as open_invites,
      (select count(*)::int from beta_feedback) as feedback_count,
      (select count(*)::int from intent_signups) as waitlist_count,
      (select coalesce(sum(jsonb_array_length(coalesce(state->'products', '[]'::jsonb))), 0)::int from portfolio_state) as active_products
  `;
  const c = counts[0] as {
    users: number;
    active_beta: number;
    open_invites: number;
    feedback_count: number;
    waitlist_count: number;
    active_products: number;
  };

  const members = await sql()`
    select
      u.id as user_id,
      u.email,
      coalesce(p.plan_key, 'free') as plan_key,
      b.expires_at,
      ps.updated_at as portfolio_updated_at,
      coalesce(jsonb_array_length(coalesce(ps.state->'products', '[]'::jsonb)), 0)::int as active_products,
      coalesce((select count(*)::int from beta_feedback bf where bf.user_id = u.id), 0)::int as feedback_count
    from founding_beta_access b
    join users u on u.id = b.user_id
    left join account_plans p on p.user_id = u.id
    left join portfolio_state ps on ps.user_id = u.id
    where b.expires_at > now()
    order by coalesce(ps.updated_at, b.granted_at) desc
  `;

  const feedback = await sql()`
    select bf.id, u.email, bf.category, bf.message, bf.route, bf.created_at
      from beta_feedback bf
      join users u on u.id = bf.user_id
     order by bf.created_at desc
     limit 25
  `;

  return {
    users: c.users,
    activeFoundingBeta: c.active_beta,
    openInvites: c.open_invites,
    feedbackCount: c.feedback_count,
    waitlistCount: c.waitlist_count,
    activePortfolioProducts: c.active_products,
    members: (members as unknown as Array<Record<string, unknown>>).map((row) => ({
      userId: Number(row.user_id),
      email: String(row.email),
      planKey: String(row.plan_key),
      betaExpiresAt: String(row.expires_at),
      portfolioUpdatedAt: row.portfolio_updated_at ? String(row.portfolio_updated_at) : null,
      activeProducts: Number(row.active_products ?? 0),
      feedbackCount: Number(row.feedback_count ?? 0),
    })),
    recentFeedback: (feedback as unknown as Array<Record<string, unknown>>).map((row) => ({
      id: Number(row.id),
      email: String(row.email),
      category: String(row.category),
      message: String(row.message),
      route: row.route ? String(row.route) : null,
      createdAt: String(row.created_at),
    })),
  };
}
