-- Ailhat availability observations — durable store for the live-sync ingest.
--
-- Receives the extension's {provider, url, ...} payload and keeps the newest
-- observation per (provider, url) so the live availability feed survives Vercel
-- serverless cold starts (a plain JSON file under data/ does not — the previous
-- store was ephemeral between invocations). Matches the style of 001.
--
-- `use` is a reserved word in Postgres, so the extension's optional `use` field
-- is stored as `use_note` (mapped back to `use` on read).
create table if not exists availability_observations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  url text not null,
  cap numeric,
  next numeric,
  title text,
  method text,
  confidence text,
  account text,
  iface text,
  id_field text,
  use_note text,
  observed_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  unique (provider, url)
);
create index if not exists idx_availability_observations_url
  on availability_observations(url);
create index if not exists idx_availability_observations_observed_at
  on availability_observations(observed_at);
