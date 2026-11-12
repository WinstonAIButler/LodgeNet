-- LodgeNet members-only website pages: what /site/<slug>/<page> shows a signed-in brother.
-- Paste into the Supabase SQL editor and Run, after schema.sql and public-site.sql. Safe to run again. It adds one read-only
-- function and changes no tables or data.
--
-- Publish keeps a members-only page's sections in lodges.data -> 'published' -> 'members', beside the public copy in
-- 'published' -> 'site'. published_site() returns only 'site', so visitors never receive members-only content; the public
-- copy holds just the page's title and address. This function hands one members-only page, with the news and dues it
-- shows, to a signed-in account that is on that lodge's roll (any role), and only while the lodge's plan is paid for.

create or replace function public.members_page(s text, p text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
      'page', l.data->'published'->'members'->'pages'->p,
      'dues', l.data->'published'->'members'->'dues',
      'news', l.data->'published'->'members'->'news')
  from public.lodges l
  where l.slug=s
    and auth.uid() is not null
    and exists(select 1 from public.lodge_members m where m.lodge_id=l.id and m.user_id=auth.uid())
    and l.data->'published'->'members'->'pages' ? p
    and (coalesce(l.comped,false) or coalesce(l.billing_status,'') in ('active','trialing','past_due'))
$$;
revoke execute on function public.members_page(text,text) from public, anon;
grant execute on function public.members_page(text,text) to authenticated;
