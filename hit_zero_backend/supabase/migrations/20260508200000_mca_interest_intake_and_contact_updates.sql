-- MCA follow-up changes from Carissa:
-- - All Star offerings collect interest/evaluation leads, not direct signups.
-- - Public contact email moves to teammca@mcaminot.com.
-- - Registrations can retain the full MCA intake detail set as structured JSON.

alter table public.registrations
  add column if not exists intake_metadata jsonb not null default '{}'::jsonb;

comment on column public.registrations.intake_metadata is
  'Structured public intake details beyond the core registration fields, including emergency contact, medical, policy, media, shirt size, and MCA form acknowledgements.';

update public.programs
set public_email = 'teammca@mcaminot.com',
    updated_at = now()
where slug = 'mca';

update public.program_classes c
set registration_open = false,
    description = concat_ws(' ', nullif(c.description, ''), 'All Star interest only: staff evaluates athletes and places them on the correct team/class.'),
    updated_at = now()
from public.program_tracks t
where c.track_id = t.id
  and t.program_id = c.program_id
  and t.slug = 'fall-2026-all-star';

update public.program_tracks
set cta_label = 'I''m interested',
    cta_kind = 'register',
    updated_at = now()
where slug = 'fall-2026-all-star'
  and program_id = (select id from public.programs where slug = 'mca');
