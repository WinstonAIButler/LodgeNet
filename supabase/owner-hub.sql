-- LodgeNet owner's hub (/owner): the platform owner's view of every lodge, account and plan code.
-- Run after schema.sql. Put the owner's email in place of ADMIN_EMAIL. Safe to run again.
--
-- Access is decided here, not in the browser: every hub call goes through a function below that first checks
-- is_platform_admin(), which is true only for a signed-in account whose confirmed email is in platform_admins.
-- platform_admins can't be read or changed from the site; add or remove owners here in the SQL editor.

create table if not exists public.platform_admins(
  email text primary key,                     -- lower case
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

insert into public.platform_admins(email) values(lower('ADMIN_EMAIL')) on conflict do nothing;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from auth.users u join public.platform_admins a on a.email=lower(u.email)
                where u.id=auth.uid() and u.email_confirmed_at is not null)
$$;
revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public.require_platform_admin() returns void
language plpgsql stable security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'This is for the LodgeNet owner only.'; end if;
end $$;
revoke execute on function public.require_platform_admin() from public, anon, authenticated;

create or replace function public.admin_codes() returns setof public.plan_codes
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  return query select * from public.plan_codes order by created_at desc;
end $$;

create or replace function public.admin_add_code(c text, p text, max_uses integer, expires_at timestamptz, note text) returns text
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  insert into public.plan_codes(code,plan,max_uses,expires_at,note)
    values(upper(trim(c)),p,max_uses,expires_at,nullif(trim(note),''));
  return upper(trim(c));
end $$;

-- a code stops working at once; uses already redeemed keep their plan
create or replace function public.admin_end_code(c text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  update public.plan_codes set expires_at=now() where code=c;
end $$;

create or replace function public.admin_set_plan(lid uuid, p text, is_comped boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  update public.lodges set plan=p,comped=is_comped where id=lid;
  if not found then raise exception 'No such lodge.'; end if;
end $$;

-- a new lodge row and its account owner's invite; the lodge's page (lodges/<slug>.html) is added in the repo
create or replace function public.admin_add_lodge(s text, n text, num text, ci text, st text, gl text, p text, owner_email text) returns uuid
language plpgsql security definer set search_path=public as $$
declare lid uuid;
begin
  perform public.require_platform_admin();
  insert into public.lodges(slug,name,number,city,state,grand_lodge,plan)
    values(lower(trim(s)),trim(n),nullif(trim(num),''),nullif(trim(ci),''),nullif(trim(st),''),nullif(trim(gl),''),p)
    returning id into lid;
  if nullif(trim(owner_email),'') is not null then
    insert into public.lodge_invites(lodge_id,email,role) values(lid,lower(trim(owner_email)),'owner')
      on conflict (lodge_id,email) do update set role='owner';
  end if;
  return lid;
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_codes()',
    'admin_add_code(text,text,integer,timestamptz,text)','admin_end_code(text)',
    'admin_set_plan(uuid,text,boolean)','admin_add_lodge(text,text,text,text,text,text,text,text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Stripe API key, entered on the hub. Write-only from the site: the hub can save, replace or remove it and sees
-- only test/live and the last four characters. Only server code using the service role key can read the value.
-- Server code uses Vercel's STRIPE_SECRET_KEY when it is set (the Vercel Stripe integration) and this one otherwise.
create table if not exists public.platform_secrets(
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.platform_secrets enable row level security;
revoke all on public.platform_secrets from anon, authenticated;

create or replace function public.admin_set_stripe_key(k text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  k:=trim(k);
  if k !~ '^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$' then
    raise exception 'That doesn''t look like a Stripe secret or restricted key (sk_… or rk_…).';
  end if;
  insert into public.platform_secrets(name,value,updated_by) values('stripe_secret_key',k,auth.uid())
    on conflict (name) do update set value=excluded.value,updated_at=now(),updated_by=auth.uid();
end $$;

create or replace function public.admin_clear_stripe_key() returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  delete from public.platform_secrets where name='stripe_secret_key';
end $$;

create or replace function public.admin_stripe_key_status() returns table(kind text, mode text, last4 text, updated_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  return query select case when s.value like 'rk_%' then 'restricted' else 'secret' end,
      split_part(s.value,'_',2), right(s.value,4), s.updated_at
    from public.platform_secrets s where s.name='stripe_secret_key';
end $$;

revoke execute on function public.admin_set_stripe_key(text) from public, anon;
revoke execute on function public.admin_clear_stripe_key() from public, anon;
revoke execute on function public.admin_stripe_key_status() from public, anon;
grant execute on function public.admin_set_stripe_key(text) to authenticated;
grant execute on function public.admin_clear_stripe_key() to authenticated;
grant execute on function public.admin_stripe_key_status() to authenticated;

-- Master dashboard: monitor and change every lodge and account, and delete them.
-- Deleting is permanent and refuses to touch the owner's own account or another platform owner; each delete also
-- needs the account's email (or the lodge's page address) passed back as confirmation.

drop function if exists public.admin_lodges();
create function public.admin_lodges() returns table(
  id uuid, slug text, name text, number text, city text, state text, grand_lodge text, plan text, comped boolean,
  billing_status text, has_dashboard boolean, members integer, invites integer, owners text[],
  created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  return query
    select l.id,l.slug,l.name,l.number,l.city,l.state,l.grand_lodge,l.plan,l.comped,l.billing_status,l.data is not null,
      (select count(*)::int from public.lodge_members m where m.lodge_id=l.id),
      (select count(*)::int from public.lodge_invites i where i.lodge_id=l.id),
      array(select coalesce(m.email,'') from public.lodge_members m where m.lodge_id=l.id and m.role='owner'
            union all select i.email||' (invited)' from public.lodge_invites i where i.lodge_id=l.id and i.role='owner'),
      l.created_at,l.updated_at
    from public.lodges l order by l.created_at;
end $$;

drop function if exists public.admin_users();
create function public.admin_users() returns table(
  id uuid, email text, confirmed boolean, blocked boolean, is_admin boolean,
  created_at timestamptz, last_sign_in_at timestamptz, lodges jsonb)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  return query
    select u.id,u.email::text,u.email_confirmed_at is not null,coalesce(u.banned_until>now(),false),
      exists(select 1 from public.platform_admins a where a.email=lower(u.email)),
      u.created_at,u.last_sign_in_at,
      coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'name',l.name,'number',l.number,'slug',l.slug,'role',m.role) order by l.name)
                from public.lodge_members m join public.lodges l on l.id=m.lodge_id where m.user_id=u.id),'[]'::jsonb)
    from auth.users u order by u.created_at desc;
end $$;

-- one lodge's roll: signed-in brethren and invites still waiting
create or replace function public.admin_lodge_roll(lid uuid) returns table(user_id uuid, email text, role text, invited boolean, created_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  return query
    select m.user_id,m.email,m.role,false,m.created_at from public.lodge_members m where m.lodge_id=lid
    union all select null::uuid,i.email,i.role,true,i.created_at from public.lodge_invites i where i.lodge_id=lid
    order by 4,5;
end $$;

create or replace function public.admin_update_lodge(lid uuid, n text, num text, ci text, st text, gl text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  if nullif(trim(n),'') is null then raise exception 'Enter the lodge''s name.'; end if;
  update public.lodges set name=trim(n),number=nullif(trim(num),''),city=nullif(trim(ci),''),
    state=nullif(upper(trim(st)),''),grand_lodge=nullif(trim(gl),'') where id=lid;
  if not found then raise exception 'No such lodge.'; end if;
end $$;

create or replace function public.admin_set_member_role(lid uuid, uid uuid, r text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  update public.lodge_members set role=r where lodge_id=lid and user_id=uid;
  if not found then raise exception 'That brother isn''t on this lodge.'; end if;
end $$;

create or replace function public.admin_remove_member(lid uuid, uid uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  delete from public.lodge_members where lodge_id=lid and user_id=uid;
end $$;

create or replace function public.admin_invite(lid uuid, e text, r text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  if lower(trim(e)) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Check the email address.'; end if;
  insert into public.lodge_invites(lodge_id,email,role) values(lid,lower(trim(e)),r)
    on conflict (lodge_id,email) do update set role=excluded.role;
end $$;

create or replace function public.admin_cancel_invite(lid uuid, e text) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  delete from public.lodge_invites where lodge_id=lid and email=lower(trim(e));
end $$;

-- the platform owner's own account and other platform owners can't be blocked or deleted from the site
create or replace function public.admin_guard_user(uid uuid) returns text
language plpgsql stable security definer set search_path=public as $$
declare e text;
begin
  select lower(email) into e from auth.users where id=uid;
  if e is null then raise exception 'No such account.'; end if;
  if uid=auth.uid() then raise exception 'That''s your own account.'; end if;
  if exists(select 1 from public.platform_admins where email=e) then raise exception 'That account is a LodgeNet owner; change it in the SQL editor.'; end if;
  return e;
end $$;
revoke execute on function public.admin_guard_user(uuid) from public, anon, authenticated;

-- marks an account's email as confirmed, for someone whose confirmation email never arrived
create or replace function public.admin_confirm_user(uid uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id=uid;
end $$;

-- a blocked account can't sign in until it's unblocked; nothing is deleted
create or replace function public.admin_block_user(uid uuid, blocked boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
  perform public.require_platform_admin();
  perform public.admin_guard_user(uid);
  update auth.users set banned_until=case when blocked then 'infinity'::timestamptz else null end where id=uid;
  if blocked then delete from auth.sessions where user_id=uid; end if;
end $$;

-- deletes the sign-in for good, with its lodge memberships; the lodges themselves stay
create or replace function public.admin_delete_user(uid uuid, confirm_email text) returns void
language plpgsql security definer set search_path=public as $$
declare e text;
begin
  perform public.require_platform_admin();
  e:=public.admin_guard_user(uid);
  if lower(trim(confirm_email)) is distinct from e then raise exception 'Type the account''s email exactly to delete it.'; end if;
  delete from auth.users where id=uid;
end $$;

-- deletes a lodge with its dashboard, roll and invites; refused while it still has a Stripe subscription running
create or replace function public.admin_delete_lodge(lid uuid, confirm_slug text) returns void
language plpgsql security definer set search_path=public as $$
declare l public.lodges;
begin
  perform public.require_platform_admin();
  select * into l from public.lodges where id=lid;
  if not found then raise exception 'No such lodge.'; end if;
  if lower(trim(confirm_slug)) is distinct from l.slug then raise exception 'Type the lodge''s page address exactly to delete it.'; end if;
  if l.billing_status in ('active','trialing','past_due','unpaid') then
    raise exception 'This lodge still has a Stripe subscription (%). Cancel it in Stripe first, then delete the lodge.', l.billing_status;
  end if;
  delete from public.lodges where id=lid;
end $$;

do $$
declare f text;
begin
  foreach f in array array['admin_lodges()','admin_users()','admin_lodge_roll(uuid)',
    'admin_update_lodge(uuid,text,text,text,text,text)','admin_set_member_role(uuid,uuid,text)','admin_remove_member(uuid,uuid)',
    'admin_invite(uuid,text,text)','admin_cancel_invite(uuid,text)','admin_confirm_user(uuid)','admin_block_user(uuid,boolean)',
    'admin_delete_user(uuid,text)','admin_delete_lodge(uuid,text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
