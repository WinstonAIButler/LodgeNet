-- Web addresses for lodge websites: bought through LodgeNet (resold via Name.com) or one the lodge already owns.
-- Run once in the Supabase SQL editor. api/domains.js reads and writes this table with the service role; browsers never
-- touch it directly (Row Level Security is on with no policies). site_slug_for_host() is the one public lookup:
-- the lodge website (assets/lodge-site.js) asks which lodge a live domain belongs to.

create table if not exists public.lodge_domains(
  id uuid primary key default gen_random_uuid(),
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  name text unique not null,                   -- the bare domain, e.g. lodge368.org
  source text not null check (source in ('purchased','connected')),
  status text not null,                        -- checkout, paid, registering, dns, attaching, pending, verifying, live, refunded, needs_attention, removed
  is_primary boolean not null default false,
  years int not null default 1,
  price_cents int not null default 0,          -- what the lodge pays each year
  attempts int not null default 0,
  last_error text,
  last_check jsonb,                            -- {ok, checkedAt, items:[{label, ok, detail}]}
  expires_at timestamptz,
  registrant jsonb,                            -- the legal owner's details; cleared once the domain is registered
  stripe_session_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text unique,          -- yearly renewal
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lodge_domains_lodge on public.lodge_domains(lodge_id);
create index if not exists lodge_domains_status on public.lodge_domains(status);
alter table public.lodge_domains enable row level security;

create or replace function public.site_slug_for_host(h text) returns text
language sql stable security definer set search_path = public as $$
  select l.slug from public.lodge_domains d join public.lodges l on l.id = d.lodge_id
  where d.status = 'live' and d.name = regexp_replace(lower(split_part(h, ':', 1)), '^www\.', '')
  limit 1
$$;
grant execute on function public.site_slug_for_host(text) to anon, authenticated;
