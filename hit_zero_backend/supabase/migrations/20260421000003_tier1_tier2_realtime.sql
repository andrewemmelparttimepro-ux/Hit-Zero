-- ═══════════════════════════════════════════════════════════════════════════
-- 20260421000003_tier1_tier2_realtime.sql
-- Broadcast the new Tier 1/Tier 2 tables the client subscribes to.
-- ═══════════════════════════════════════════════════════════════════════════

alter publication supabase_realtime add table message_threads;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table message_reads;
alter publication supabase_realtime add table session_availability;
alter publication supabase_realtime add table registrations;
alter publication supabase_realtime add table form_responses;
alter publication supabase_realtime add table emergency_contacts;
alter publication supabase_realtime add table injuries;
alter publication supabase_realtime add table uniform_orders;
alter publication supabase_realtime add table leads;
alter publication supabase_realtime add table lead_touches;
alter publication supabase_realtime add table volunteer_assignments;
alter publication supabase_realtime add table practice_plans;
alter publication supabase_realtime add table practice_plan_blocks;
