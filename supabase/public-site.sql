-- LodgeNet public lodge websites: what /site/<slug> shows.
-- Paste into the Supabase SQL editor and Run. Safe to run again. It adds one read-only function and changes no tables or data.
--
-- "Publish site" on the lodge dashboard saves a copy of the public parts of the Website form in lodges.data -> 'published'
-- (name, schedule, officers' names, upcoming event titles, contact, social and giving links; never the roster, dues, minutes or treasury).
-- Visitors aren't signed in, so they can't read the lodges table. This function hands them only that published copy,
-- and only while the lodge's plan is paid for or comped, so a lapsed plan takes the site down without anyone touching it.

create or replace function public.published_site(s text) returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('slug',l.slug,'site',l.data->'published'->'site','at',l.data->'published'->'at')
  from public.lodges l
  where l.slug=s
    and l.data ? 'published' and jsonb_typeof(l.data->'published')='object'
    and (coalesce(l.comped,false) or coalesce(l.billing_status,'') in ('active','trialing','past_due'))
$$;
revoke execute on function public.published_site(text) from public;
grant execute on function public.published_site(text) to anon, authenticated;
