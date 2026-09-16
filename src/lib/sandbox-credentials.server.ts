import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { sql } from "~/db";
import { migrateAuth } from "~/lib/auth";

const MIGRATION_SANDBOX_CREDENTIALS = `
CREATE TABLE IF NOT EXISTS product_sandbox_credentials (
  user_id            bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_key        text        NOT NULL,
  sandbox_url        text        NOT NULL,
  username           text        NOT NULL,
  account_scope      text        NOT NULL DEFAULT 'standard',
  secret_ciphertext  text        NOT NULL,
  secret_iv          text        NOT NULL,
  secret_tag         text        NOT NULL,
  last_verified_at   timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_key)
);
`;

export type SandboxAccountScope = "standard" | "admin";

export interface SandboxCredentialMetadata {
  configured: boolean;
  productId: string;
  sandboxUrl: string | null;
  username: string | null;
  accountScope: SandboxAccountScope | null;
  updatedAt: string | null;
  lastVerifiedAt: string | null;
}

export interface SandboxCredentialForExecution {
  productId: string;
  sandboxUrl: string;
  username: string;
  password: string;
  accountScope: SandboxAccountScope;
}

function normalizedProductKey(value: string): string {
  const productKey = value.trim();
  if (!productKey || productKey.length > 128) throw new Error("invalid_product_id");
  return productKey;
}

function normalizedSandboxUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("invalid_sandbox_url");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("invalid_sandbox_url");
  }
  url.hash = "";
  return url.toString();
}

function normalizedUsername(value: string): string {
  const username = value.trim();
  if (!username || username.length > 320) throw new Error("invalid_username");
  return username;
}

function normalizedScope(value: string | undefined): SandboxAccountScope {
  if (!value || value === "standard") return "standard";
  if (value === "admin") return "admin";
  throw new Error("invalid_account_scope");
}

function encryptionKey(): Buffer {
  const raw = process.env.AILHAT_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("sandbox_secret_store_unavailable");

  let key: Buffer;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new Error("invalid_sandbox_encryption_key");
    }
  }

  if (key.length !== 32) throw new Error("invalid_sandbox_encryption_key");
  return key;
}

function encryptSecret(secret: string): { ciphertext: string; iv: string; tag: string } {
  if (!secret || secret.length > 4096) throw new Error("invalid_password");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    ciphertext: encrypted.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
  };
}

function decryptSecret(ciphertext: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

export async function migrateSandboxCredentials(): Promise<void> {
  await migrateAuth();
  const q = sql() as unknown as { query: (text: string) => Promise<unknown> };
  await q.query(MIGRATION_SANDBOX_CREDENTIALS);
}

export async function getSandboxCredentialMetadata(
  userId: number,
  rawProductId: string,
): Promise<SandboxCredentialMetadata> {
  const productId = normalizedProductKey(rawProductId);
  await migrateSandboxCredentials();
  const rows = await sql()`
    select sandbox_url, username, account_scope, updated_at, last_verified_at
    from product_sandbox_credentials
    where user_id = ${userId} and product_key = ${productId}
    limit 1
  `;
  if (rows.length === 0) {
    return {
      configured: false,
      productId,
      sandboxUrl: null,
      username: null,
      accountScope: null,
      updatedAt: null,
      lastVerifiedAt: null,
    };
  }
  const row = rows[0] as Record<string, unknown>;
  return {
    configured: true,
    productId,
    sandboxUrl: String(row.sandbox_url),
    username: String(row.username),
    accountScope: normalizedScope(String(row.account_scope)),
    updatedAt: String(row.updated_at),
    lastVerifiedAt: row.last_verified_at ? String(row.last_verified_at) : null,
  };
}

export async function saveSandboxCredential(input: {
  userId: number;
  productId: string;
  sandboxUrl: string;
  username: string;
  password?: string;
  accountScope?: string;
}): Promise<SandboxCredentialMetadata> {
  const productId = normalizedProductKey(input.productId);
  const sandboxUrl = normalizedSandboxUrl(input.sandboxUrl);
  const username = normalizedUsername(input.username);
  const accountScope = normalizedScope(input.accountScope);
  await migrateSandboxCredentials();

  const current = await sql()`
    select secret_ciphertext, secret_iv, secret_tag
    from product_sandbox_credentials
    where user_id = ${input.userId} and product_key = ${productId}
    limit 1
  `;

  let encrypted: { ciphertext: string; iv: string; tag: string };
  if (input.password) {
    encrypted = encryptSecret(input.password);
  } else if (current.length > 0) {
    const row = current[0] as Record<string, unknown>;
    encrypted = {
      ciphertext: String(row.secret_ciphertext),
      iv: String(row.secret_iv),
      tag: String(row.secret_tag),
    };
  } else {
    throw new Error("password_required");
  }

  await sql()`
    insert into product_sandbox_credentials (
      user_id, product_key, sandbox_url, username, account_scope,
      secret_ciphertext, secret_iv, secret_tag, updated_at
    ) values (
      ${input.userId}, ${productId}, ${sandboxUrl}, ${username}, ${accountScope},
      ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.tag}, now()
    )
    on conflict (user_id, product_key) do update set
      sandbox_url = excluded.sandbox_url,
      username = excluded.username,
      account_scope = excluded.account_scope,
      secret_ciphertext = excluded.secret_ciphertext,
      secret_iv = excluded.secret_iv,
      secret_tag = excluded.secret_tag,
      last_verified_at = case
        when product_sandbox_credentials.sandbox_url <> excluded.sandbox_url
          or product_sandbox_credentials.username <> excluded.username
          or product_sandbox_credentials.secret_ciphertext <> excluded.secret_ciphertext
        then null
        else product_sandbox_credentials.last_verified_at
      end,
      updated_at = now()
  `;

  return getSandboxCredentialMetadata(input.userId, productId);
}

export async function revokeSandboxCredential(userId: number, rawProductId: string): Promise<void> {
  const productId = normalizedProductKey(rawProductId);
  await migrateSandboxCredentials();
  await sql()`
    delete from product_sandbox_credentials
    where user_id = ${userId} and product_key = ${productId}
  `;
}

/**
 * Server-only runtime retrieval for an authorized browser executor.
 * Never expose this return value through an API response, evidence record, log,
 * prompt, screenshot, analytics event, or client-side state.
 */
export async function getSandboxCredentialForExecution(
  userId: number,
  rawProductId: string,
): Promise<SandboxCredentialForExecution | null> {
  const productId = normalizedProductKey(rawProductId);
  await migrateSandboxCredentials();
  const rows = await sql()`
    select sandbox_url, username, account_scope, secret_ciphertext, secret_iv, secret_tag
    from product_sandbox_credentials
    where user_id = ${userId} and product_key = ${productId}
    limit 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    productId,
    sandboxUrl: String(row.sandbox_url),
    username: String(row.username),
    accountScope: normalizedScope(String(row.account_scope)),
    password: decryptSecret(
      String(row.secret_ciphertext),
      String(row.secret_iv),
      String(row.secret_tag),
    ),
  };
}
