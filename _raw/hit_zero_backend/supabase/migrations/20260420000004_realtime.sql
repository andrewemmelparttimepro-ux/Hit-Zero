-- ═══════════════════════════════════════════════════════════════════════════
-- 20260420000004_realtime.sql
-- Enable realtime broadcast for the tables the client subscribes to.
-- ═══════════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table athlete_skills;
alter publication supabase_realtime add table celebrations;
alter publication supabase_realtime add table attendance;
alter publication supabase_realtime add table score_runs;
alter publication supabase_realtime add table score_deductions;
alter publication supabase_realtime add table announcements;
alter publication supabase_realtime add table routines;
alter publication supabase_realtime add table routine_sections;
alter publication supabase_realtime add table skill_placements;
alter publication supabase_realtime add table videos;
alter publication supabase_realtime add table video_notes;
alter publication supabase_realtime add table billing_accounts;
alter publication supabase_realtime add table billing_charges;
