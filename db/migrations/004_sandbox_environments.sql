CREATE TABLE IF NOT EXISTS product_sandbox_environments (
  user_id                 bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_key             text        NOT NULL,
  provider                text        NOT NULL DEFAULT 'here-now',
  provider_connection_ref text        NOT NULL DEFAULT 'owner:provider:here-now',
  slug                     text,
  sandbox_url              text        NOT NULL,
  lifecycle                text        NOT NULL DEFAULT 'configured',
  static_primary           boolean     NOT NULL DEFAULT true,
  current_version_id       text,
  source_repository        text,
  source_ref               text,
  verification_state       text        NOT NULL DEFAULT 'unknown',
  verified_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_key, provider)
);

CREATE INDEX IF NOT EXISTS product_sandbox_environments_user_provider_idx
  ON product_sandbox_environments(user_id, provider, updated_at DESC);
