-- LodgeNet accounts: lodges, who belongs to each, and invites waiting to be claimed.
-- Paste into the Supabase SQL editor and Run. Safe to run again.
--
-- Roles on a lodge:
--   owner    runs the account: invites and removes brethren, edits everything
--   officer  edits the lodge dashboard (website, store, calendar, members, minutes)
--   member   signs in and reads the dashboard
-- A lodge's dashboard is saved as one JSON document in lodges.data (the same shape as an Export).

create table if not exists public.lodges(
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,                  -- matches lodges/<slug>.html
  name text not null,
  number text,
  city text,
  state text,
  grand_lodge text,
  plan text not null default 'lodge' check (plan in ('starter','lodge','district')),
  data jsonb,                                 -- null until the first save; the page's own data is used until then
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table if not exists public.lodge_members(
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner','officer','member')),
  created_at timestamptz not null default now(),
  primary key(lodge_id,user_id)
);

create table if not exists public.lodge_invites(
  lodge_id uuid not null references public.lodges(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner','officer','member')),
  created_at timestamptz not null default now(),
  primary key(lodge_id,email)
);

-- the signed-in user's role on a lodge (security definer so policies can call it without recursion)
create or replace function public.lodge_role(lid uuid) returns text
language sql stable security definer set search_path=public as $$
  select role from public.lodge_members where lodge_id=lid and user_id=auth.uid()
$$;

-- turns invites for the signed-in user's confirmed email into memberships
create or replace function public.claim_invites() returns integer
language plpgsql security definer set search_path=public as $$
declare e text; n integer;
begin
  select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if e is null then return 0; end if;
  insert into public.lodge_members(lodge_id,user_id,email,role)
    select lodge_id,auth.uid(),e,role from public.lodge_invites where lower(email)=e
    on conflict (lodge_id,user_id) do nothing;
  get diagnostics n=row_count;
  delete from public.lodge_invites where lower(email)=e;
  return n;
end $$;
revoke execute on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;

create or replace function public.lodges_touch() returns trigger
language plpgsql as $$
begin new.updated_at=now(); new.updated_by=auth.uid(); return new; end $$;
drop trigger if exists lodges_touch on public.lodges;
create trigger lodges_touch before update on public.lodges for each row execute function public.lodges_touch();

alter table public.lodges enable row level security;
alter table public.lodge_members enable row level security;
alter table public.lodge_invites enable row level security;

-- lodges: members read; owners and officers save the dashboard. Only the data column can change from the site,
-- so plan, name and slug are set here in SQL (or in the Supabase table editor).
drop policy if exists "members read their lodge" on public.lodges;
create policy "members read their lodge" on public.lodges for select to authenticated
  using (public.lodge_role(id) is not null);
drop policy if exists "officers save their lodge" on public.lodges;
create policy "officers save their lodge" on public.lodges for update to authenticated
  using (public.lodge_role(id) in ('owner','officer')) with check (public.lodge_role(id) in ('owner','officer'));
revoke insert, update, delete on public.lodges from anon, authenticated;
grant select on public.lodges to authenticated;
grant update (data) on public.lodges to authenticated;

-- memberships: brethren see who else is on their lodge; the owner changes roles and removes people
drop policy if exists "members see the roll" on public.lodge_members;
create policy "members see the roll" on public.lodge_members for select to authenticated
  using (user_id=auth.uid() or public.lodge_role(lodge_id) is not null);
drop policy if exists "owner manages the roll" on public.lodge_members;
create policy "owner manages the roll" on public.lodge_members for update to authenticated
  using (public.lodge_role(lodge_id)='owner') with check (public.lodge_role(lodge_id)='owner');
drop policy if exists "owner removes from the roll" on public.lodge_members;
create policy "owner removes from the roll" on public.lodge_members for delete to authenticated
  using (public.lodge_role(lodge_id)='owner' and user_id<>auth.uid());
revoke insert on public.lodge_members from anon, authenticated;

-- invites: only the owner sees and sends them
drop policy if exists "owner manages invites" on public.lodge_invites;
create policy "owner manages invites" on public.lodge_invites for all to authenticated
  using (public.lodge_role(lodge_id)='owner') with check (public.lodge_role(lodge_id)='owner');

-- plan codes: redeeming one puts a lodge on that plan at no charge (lodges.comped).
-- Codes are added in the SQL editor and can't be read from the site; only redeem_plan_code() checks them.
alter table public.lodges add column if not exists comped boolean not null default false;
create table if not exists public.plan_codes(
  code text primary key,                      -- upper case
  plan text not null check (plan in ('starter','lodge','district')),
  max_uses integer,                           -- null for unlimited
  uses integer not null default 0,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
alter table public.plan_codes enable row level security;
revoke all on public.plan_codes from anon, authenticated;

create or replace function public.redeem_plan_code(lid uuid, c text) returns text
language plpgsql security definer set search_path=public as $$
declare p public.plan_codes;
begin
  if public.lodge_role(lid) is distinct from 'owner' then
    raise exception 'Only the lodge''s account owner can redeem a code.';
  end if;
  select * into p from public.plan_codes where code=upper(trim(c)) for update;
  if not found or (p.expires_at is not null and p.expires_at<now()) or (p.max_uses is not null and p.uses>=p.max_uses) then
    raise exception 'That code isn''t valid or has been used up.';
  end if;
  update public.plan_codes set uses=uses+1 where code=p.code;
  update public.lodges set plan=p.plan, comped=true where id=lid;
  return p.plan;
end $$;
revoke execute on function public.redeem_plan_code(uuid,text) from public, anon;
grant execute on function public.redeem_plan_code(uuid,text) to authenticated;
