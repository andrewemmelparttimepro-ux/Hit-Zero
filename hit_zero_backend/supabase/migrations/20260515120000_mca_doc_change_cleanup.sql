-- Hit Zero / MCA doc-change cleanup.
-- Adds fields requested by MCA and removes only confirmed seed/demo rows from the live MCA program.

alter table public.sessions
  add column if not exists title text;

alter table public.registrations
  add column if not exists decision_reason text;

alter table public.programs
  add column if not exists public_hero_image_url text,
  add column if not exists public_gallery_image_urls text[] not null default '{}'::text[];

comment on column public.sessions.title is 'Staff-entered public-facing event title, separate from event type.';
comment on column public.registrations.decision_reason is 'Staff note for rejection, waitlist, or reassignment decisions.';
comment on column public.programs.public_hero_image_url is 'Owner-managed public website hero image URL.';
comment on column public.programs.public_gallery_image_urls is 'Owner-managed public website gallery image URLs.';

drop view if exists public.program_public_directory;

create view public.program_public_directory as
select
  p.id,
  p.slug,
  coalesce(p.public_name, p.name) as public_name,
  coalesce(p.brand_name, p.public_name, p.name) as brand_name,
  p.description,
  p.website_url,
  p.logo_url,
  p.public_hero_image_url,
  p.public_gallery_image_urls,
  p.public_email,
  p.public_phone,
  p.address_line1,
  p.address_line2,
  p.city,
  p.state,
  p.postal_code,
  p.country,
  p.latitude,
  p.longitude,
  p.directory_tags,
  p.age_range_min,
  p.age_range_max,
  p.is_accepting_leads,
  coalesce(ps.default_provider, 'manual') as payment_provider,
  coalesce(ps.public_checkout_enabled, false) as public_checkout_enabled,
  coalesce(ps.checkout_mode, 'none') as checkout_mode,
  ps.public_payment_note
from public.programs p
left join public.program_payment_settings ps on ps.program_id = p.id
where p.is_public is true
  and p.deleted_at is null;

grant select on public.program_public_directory to anon, authenticated;
alter view public.program_public_directory set (security_invoker = on);

delete from public.announcements
where program_id = '11111111-1111-1111-1111-111111111111'
  and (title, coalesce(body, '')) in (
    ('Nationals hotel block closes Friday', 'Book through the team portal — rooms run out every year.'),
    ('April tuition draft', 'Autopay runs the 1st. Update cards in the Billing tab.'),
    ('Hair + makeup rehearsal Sat 9am', 'Full comp look. Pictures after.')
  );

delete from public.uniform_orders
where uniform_id in (
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000002'
);

delete from public.uniform_items
where uniform_id in (
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000002'
);

delete from public.uniforms
where id in (
  'd1000000-0000-0000-0000-000000000001',
  'd1000000-0000-0000-0000-000000000002'
)
and program_id = '11111111-1111-1111-1111-111111111111';

delete from public.leads
where program_id = '11111111-1111-1111-1111-111111111111'
  and parent_email in ('hanna@demo.com', 'marcus@demo.com', 'priya@demo.com', 'jallen@demo.com')
  and parent_phone like '701-555-%';
