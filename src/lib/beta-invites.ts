import { createHash } from "node:crypto";
import { sql } from "~/db";
import { migrateAccess } from "./access";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function validateFoundingBetaInvite(
  token: string,
  email: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!token || !normalizedEmail) return false;
  await migrateAccess();
  const rows = await sql()`
    select id
      from founding_beta_invites
     where token_hash = ${sha256(token)}
       and lower(email) = lower(${normalizedEmail})
       and expires_at > now()
       and redeemed_at is null
     limit 1
  `;
  return rows.length > 0;
}
