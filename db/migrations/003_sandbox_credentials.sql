-- Encrypted sandbox/test-account bindings for Product Cockpit.
-- Secret plaintext must never be stored in this table. AES-256-GCM encryption
-- uses the server-only AILHAT_CREDENTIAL_ENCRYPTION_KEY environment secret.

create table if not exists product_sandbox_credentials (
  user_id            bigint      not null references users(id) on delete cascade,
  product_key        text        not null,
  sandbox_url        text        not null,
  username           text        not null,
  account_scope      text        not null default 'standard',
  secret_ciphertext  text        not null,
  secret_iv          text        not null,
  secret_tag         text        not null,
  last_verified_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (user_id, product_key)
);
