begin;
create table if not exists public.program_public_resources (
 program_id uuid not null references public.programs(id) on delete cascade,
 resource_key text not null check(resource_key ~ '^[a-z][a-z0-9_]{1,60}$'),
 content jsonb not null check(jsonb_typeof(content)='object'),
 published boolean not null default false,
 updated_at timestamptz not null default now(),
 source_reference text,
 primary key(program_id,resource_key)
);
alter table public.program_public_resources enable row level security;
create policy "Owners manage public resource copy" on public.program_public_resources for all to authenticated
 using(exists(select 1 from public.profiles p where p.id=auth.uid() and p.program_id=program_public_resources.program_id and p.role='owner'))
 with check(exists(select 1 from public.profiles p where p.id=auth.uid() and p.program_id=program_public_resources.program_id and p.role='owner'));
revoke all on public.program_public_resources from public,anon,authenticated;
grant select,insert,update,delete on public.program_public_resources to authenticated;
create or replace view public.public_program_resources as
 select r.program_id,p.slug program_slug,r.resource_key,r.content,r.updated_at
 from public.program_public_resources r join public.programs p on p.id=r.program_id
 where r.published and p.is_public and p.deleted_at is null;
revoke all on public.public_program_resources from public,anon,authenticated;
grant select on public.public_program_resources to anon,authenticated;
insert into public.program_public_resources(program_id,resource_key,content,published,source_reference)
 values('11111111-1111-1111-1111-111111111111','birthday_party',jsonb_build_object(
 'title','Celebrate with Magic.','price_cents',20000,'currency','USD',
 'summary','A 2-hour birthday party for up to 15 kids.',
 'details',jsonb_build_array('75 minutes of supervised gym time','45 minutes in the party room','Dedicated party host','MCA birthday shirt for the birthday athlete','Birthday sign and photo backdrop','A 10-visit Open Gym punch card for the birthday athlete'),
 'parents_provide','Food, cake, drinks and any decorations you would like.',
 'request_url','https://forms.gle/xHJgfeZXe1CpQNzD7',
 'image_url','https://thehitzero.net/hit_zero_web/assets/birthday-party-package.png'
 ),true,'Carissa approved package and request form; Fix-It 29553901-b220-4157-bafb-dd38437b6b57; exact source image SHA256 81e52c3c47c61a1d7d4a581fc1b4ec9aced76c4ec2fc80be3a51b1f3d8e4bb00')
 on conflict(program_id,resource_key) do nothing;
commit;
