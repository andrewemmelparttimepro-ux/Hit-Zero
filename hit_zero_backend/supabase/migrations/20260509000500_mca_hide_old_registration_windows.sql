-- Hide stale public registration windows that predate the current
-- photo-derived MCA schedule. All Star now uses the "I'm interested"
-- evaluation lead flow; Summer offerings are individual bookable classes.

update public.registration_windows
set is_public = false
where program_id = (select id from public.programs where slug = 'mca')
  and slug in ('2026-tryouts', 'summer-camp');
