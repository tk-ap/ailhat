-- Ailhat portfolio-context model
-- Seed data should be treated as conversation/user-provided context until live scans validate it.

create table if not exists portfolio_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  state text not null default 'NEEDS ASSESSMENT',
  source text not null default 'conversation_seed',
  account_ref text,
  platform text,
  url text,
  repo_ref text,
  description text,
  customer_target text,
  business_model text,
  launch_stage text,
  readiness_score numeric(5,2),
  readiness_confidence text,
  distance_to_first_paid_client text,
  last_meaningful_work_at timestamptz,
  last_scan_at timestamptz,
  last_attention_at timestamptz,
  next_review_at timestamptz,
  attention_status text not null default 'NEEDS ASSESSMENT',
  neglect_risk text not null default 'UNKNOWN',
  open_blocker_count integer not null default 0,
  top_next_action text,
  context_source text not null default 'conversation_seed',
  context_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portfolio_product_relationships (
  id uuid primary key default gen_random_uuid(),
  from_product_id uuid not null references portfolio_products(id) on delete cascade,
  to_product_id uuid not null references portfolio_products(id) on delete cascade,
  relationship_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(from_product_id, to_product_id, relationship_type)
);

create table if not exists product_context_observations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references portfolio_products(id) on delete cascade,
  observation_type text not null,
  observed_at timestamptz not null default now(),
  source text not null,
  confidence text,
  payload jsonb not null default '{}'::jsonb
);

create table if not exists product_work_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references portfolio_products(id) on delete cascade,
  title text not null,
  problem_or_opportunity text,
  evidence jsonb not null default '[]'::jsonb,
  priority text not null default 'P2',
  estimated_effort text,
  suggested_execution_mode text,
  expected_product_impact text,
  source text not null default 'ailhat',
  context_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_portfolio_products_attention on portfolio_products(attention_status, neglect_risk);
create index if not exists idx_portfolio_products_account on portfolio_products(account_ref);
create index if not exists idx_context_observations_product on product_context_observations(product_id, observed_at desc);
create index if not exists idx_work_items_product_status on product_work_items(product_id, status, priority);

-- Seed products from the current portfolio conversation. No readiness is invented except Ailhat's
-- directional ~65% assessment already established in product discussion.
insert into portfolio_products (slug,name,state,source,account_ref,description,launch_stage,readiness_score,readiness_confidence,distance_to_first_paid_client,attention_status,neglect_risk,top_next_action)
values
('ailhat','Ailhat','ACTIVE','conversation_seed','cto.new:primary','AI product intelligence and market-gap detection platform.','PRIVATE_BETA_PRE_LAUNCH',65,'MEDIUM','~4–8 meaningful work sessions','NEEDS ATTENTION','MEDIUM','Restore production reliability/auth and validate the complete live scan loop'),
('alvira','ALVIRA','PAUSED','conversation_seed','cto.new:secondary','Broader personalized-AI operating-system ecosystem: Know You → Connect Everywhere → Work With You → Act For You.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Validate current production state and reassess launch/customer target'),
('alvira-bridge','ALVIRA Bridge','PAUSED','conversation_seed','cto.new:builder','Context distribution / continuity layer for the ALVIRA ecosystem.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Validate current product state and ecosystem role'),
('ledgato','Ledgato','ACTIVE','conversation_seed','cto.new:builder','Connected product workspace; current customer and launch context require assessment.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Run a live scan and create a current-state assessment'),
('hoopdash','Hoopdash','ACTIVE','user_reported_seed','cto.new:builder','Connected business/project in the broader portfolio; current product context requires assessment.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Run a live scan and create a current-state assessment'),
('policyguard','PolicyGuard','PAUSED','user_screenshot_seed','cto.new:secondary','Paused v1 business shown in the connected cto.new portfolio.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Scan current product, confirm positioning, decide revive vs archive'),
('websitehero','WEBSITEHERO','PAUSED','user_screenshot_seed','cto.new:secondary','Purchased business shown in the connected cto.new portfolio.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Scan current site and confirm business model before revive/archive decision'),
('trendvault','TrendVault','PAUSED','user_screenshot_seed','cto.new:secondary','Purchased business shown in the connected cto.new portfolio.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Scan current site and check current market fit'),
('adscale-pro','AdScale Pro','PAUSED','user_screenshot_seed','cto.new:secondary','Purchased business shown in the connected cto.new portfolio.','NEEDS_ASSESSMENT',null,null,'Assessment required','NEEDS ASSESSMENT','HIGH','Scan current site and check offer/demand')
on conflict (slug) do update set
  state=excluded.state,
  source=excluded.source,
  account_ref=excluded.account_ref,
  description=excluded.description,
  launch_stage=excluded.launch_stage,
  readiness_score=excluded.readiness_score,
  readiness_confidence=excluded.readiness_confidence,
  distance_to_first_paid_client=excluded.distance_to_first_paid_client,
  attention_status=excluded.attention_status,
  neglect_risk=excluded.neglect_risk,
  top_next_action=excluded.top_next_action,
  context_updated_at=now(),
  updated_at=now();

-- Ecosystem boundary: Ailhat -> Agent Control is a work handoff, not a UI merge.
insert into portfolio_product_relationships (from_product_id,to_product_id,relationship_type,metadata)
select a.id, b.id, 'WORK_HANDOFF', '{"direction":"Ailhat findings → Agent Control capacity match"}'::jsonb
from portfolio_products a, portfolio_products b
where a.slug='ailhat' and b.slug='alvira'
on conflict (from_product_id,to_product_id,relationship_type) do nothing;

insert into product_context_observations (product_id, observation_type, source, confidence, payload)
select id, 'ECOSYSTEM_STRATEGY', 'conversation_seed', 'HIGH', '{"alvira_model":["Know You","Connect Everywhere","Work With You","Act For You"],"ailhat_role":"product intelligence","agent_control_role":"execution capacity intelligence"}'::jsonb
from portfolio_products where slug='ailhat'
on conflict do nothing;
