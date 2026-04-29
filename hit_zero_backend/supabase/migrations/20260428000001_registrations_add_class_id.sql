-- The marketing site lets parents book a specific priced class (Cheer 101
-- ages 5-7, Tumbling Beginner, Stunt Clinic, etc.) directly from the
-- Programs page. Until now registrations could only point at a
-- registration_window (the big-event intake forms — Tryouts, Summer Camp).
-- Adding a class_id so the booking can target a program_classes row.
--
-- Either window_id OR class_id may be set (not both required, both optional).
-- The public-intake-v1 edge function enforces program/class match + capacity.

alter table public.registrations
  add column if not exists class_id uuid references public.program_classes(id) on delete set null;

create index if not exists registrations_class_idx
  on public.registrations (class_id, created_at desc)
  where class_id is not null;

comment on column public.registrations.class_id is
  'Optional reference to the specific program_classes row a parent booked from the website. Distinct from window_id (used for big intake periods like tryouts).';
