-- Hand a lodge to a new account owner, for when the Worshipful Master and officers change hands.
-- Run after schema.sql (and owner-hub.sql, for the platform owner's side). Safe to run again.
--
-- hand_over_lodge(lodge, new owner's email, what the outgoing owner becomes):
--   * the lodge's account owner can call it for their own lodge; the LodgeNet owner (platform_admins) for any lodge
--   * if the new owner is already on the roll they become owner now, and the outgoing owner steps down now
--   * if not, they get an owner invite; the step-down waits until they create their account and claim it,
--     so the lodge is never left without someone who can run it
--   * step_down is 'officer', 'member' or 'remove' (off the roll). When the LodgeNet owner hands over a lodge,
--     every current owner steps down, or 'keep' leaves them as owners.
-- The Stripe subscription stays with the lodge, so billing carries on; the new owner manages it under My lodges.

alter table public.lodge_invites add column if not exists hands_over_from uuid references auth.users(id) on delete set null;
alter table public.lodge_invites add column if not exists step_down_to text;
alter table public.lodge_invites drop constraint if exists lodge_invites_step_down_to_check;
alter table public.lodge_invites add constraint lodge_invites_step_down_to_check check (step_down_to in ('officer','member','remove','keep'));

-- one owner steps down (never the incoming owner)
create or replace function public.step_down_owner(lid uuid, uid uuid, keep_uid uuid, to_role text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if uid is null or uid=keep_uid or to_role is null or to_role='keep' then return; end if;
  if to_role='remove' then
    delete from public.lodge_members where lodge_id=lid and user_id=uid and role='owner';
  else
    update public.lodge_members set role=to_role where lodge_id=lid and user_id=uid and role='owner';
  end if;
end $$;
revoke execute on function public.step_down_owner(uuid,uuid,uuid,text) from public, anon, authenticated;

create or replace function public.hand_over_lodge(lid uuid, new_email text, step_down text) returns text
language plpgsql security definer set search_path=public as $$
declare
  e text := lower(trim(new_email));
  admin boolean := coalesce(public.is_platform_admin(),false);
  mine boolean := public.lodge_role(lid)='owner';
  new_uid uuid; o record;
begin
  if not (mine or admin) then raise exception 'Only the lodge''s account owner can hand it over.'; end if;
  if e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'Check the new owner''s email address.'; end if;
  if step_down not in ('officer','member','remove') and not (admin and step_down='keep') then
    raise exception 'Choose what the outgoing owner becomes.';
  end if;
  if not exists(select 1 from public.lodges where id=lid) then raise exception 'That lodge doesn''t exist.'; end if;

  select user_id into new_uid from public.lodge_members where lodge_id=lid and lower(email)=e;
  if new_uid is null then
    select m.user_id into new_uid from public.lodge_members m join auth.users u on u.id=m.user_id
      where m.lodge_id=lid and lower(u.email)=e;
  end if;

  if new_uid is not null then
    update public.lodge_members set role='owner' where lodge_id=lid and user_id=new_uid;
    if mine and not admin then
      perform public.step_down_owner(lid,auth.uid(),new_uid,step_down);
    else
      for o in select user_id from public.lodge_members where lodge_id=lid and role='owner' and user_id<>new_uid loop
        perform public.step_down_owner(lid,o.user_id,new_uid,step_down);
      end loop;
    end if;
    return 'done';
  end if;

  insert into public.lodge_invites(lodge_id,email,role,hands_over_from,step_down_to)
    values(lid,e,'owner',case when mine and not admin then auth.uid() end,step_down)
    on conflict (lodge_id,email) do update set role='owner',hands_over_from=excluded.hands_over_from,step_down_to=excluded.step_down_to;
  return 'invited';
end $$;
revoke execute on function public.hand_over_lodge(uuid,text,text) from public, anon;
grant execute on function public.hand_over_lodge(uuid,text,text) to authenticated;

-- claiming invites, as in schema.sql, plus: an owner invite makes an existing member owner, and a hand-over
-- invite steps the outgoing owner (or, from the LodgeNet owner, every other owner) down once it's claimed
create or replace function public.claim_invites() returns integer
language plpgsql security definer set search_path=public as $$
declare e text; n integer; i record; o record;
begin
  select lower(email) into e from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if e is null then return 0; end if;
  insert into public.lodge_members(lodge_id,user_id,email,role)
    select lodge_id,auth.uid(),e,role from public.lodge_invites where lower(email)=e
    on conflict (lodge_id,user_id) do nothing;
  get diagnostics n=row_count;
  for i in select * from public.lodge_invites where lower(email)=e and role='owner' loop
    update public.lodge_members set role='owner' where lodge_id=i.lodge_id and user_id=auth.uid();
    if i.step_down_to is not null then
      if i.hands_over_from is not null then
        perform public.step_down_owner(i.lodge_id,i.hands_over_from,auth.uid(),i.step_down_to);
      else
        for o in select user_id from public.lodge_members where lodge_id=i.lodge_id and role='owner' and user_id<>auth.uid() loop
          perform public.step_down_owner(i.lodge_id,o.user_id,auth.uid(),i.step_down_to);
        end loop;
      end if;
    end if;
  end loop;
  delete from public.lodge_invites where lower(email)=e;
  return n;
end $$;
revoke execute on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;
