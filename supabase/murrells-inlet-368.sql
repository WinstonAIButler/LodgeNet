-- Murrells Inlet Lodge No. 368, A.F.M. on the Lodge plan.
-- Put the owner's email in place of OWNER_EMAIL, then run after schema.sql.
-- The owner creates their own password at /login (Create account) with that email; on first sign-in they own the lodge.

insert into public.lodges(slug,name,number,city,state,grand_lodge,plan)
values('murrells-inlet-368','Murrells Inlet Lodge','368','Murrells Inlet','SC',
       'Grand Lodge of Ancient Free Masons of South Carolina','lodge')
on conflict (slug) do update set plan=excluded.plan;

insert into public.lodge_invites(lodge_id,email,role)
select id,lower('OWNER_EMAIL'),'owner' from public.lodges where slug='murrells-inlet-368'
on conflict (lodge_id,email) do update set role='owner';
