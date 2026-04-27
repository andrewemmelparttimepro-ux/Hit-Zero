-- Safe public read model for the marketing website.
--
-- The website should prefer this view over raw tables when rendering gym
-- listings because it includes only public gym fields and checkout readiness.

create or replace view program_public_directory as
select
  p.id,
  p.slug,
  coalesce(p.public_name, p.name) as public_name,
  coalesce(p.brand_name, p.public_name, p.name) as brand_name,
  p.description,
  p.website_url,
  p.logo_url,
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
from programs p
left join program_payment_settings ps on ps.program_id = p.id
where p.is_public is true
  and p.deleted_at is null;

grant select on program_public_directory to anon, authenticated;
