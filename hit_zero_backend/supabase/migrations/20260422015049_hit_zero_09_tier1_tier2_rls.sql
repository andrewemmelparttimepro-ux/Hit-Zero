alter table message_threads        enable row level security;
alter table thread_members         enable row level security;
alter table messages               enable row level security;
alter table message_reads          enable row level security;
alter table session_availability   enable row level security;
alter table calendar_tokens        enable row level security;
alter table registration_windows   enable row level security;
alter table registrations          enable row level security;
alter table waiver_templates       enable row level security;
alter table waiver_signatures      enable row level security;
alter table form_templates         enable row level security;
alter table form_fields            enable row level security;
alter table form_responses         enable row level security;
alter table form_answers           enable row level security;
alter table emergency_contacts     enable row level security;
alter table medical_records        enable row level security;
alter table injuries               enable row level security;
alter table uniforms               enable row level security;
alter table uniform_items          enable row level security;
alter table uniform_orders         enable row level security;
alter table leads                  enable row level security;
alter table lead_touches           enable row level security;
alter table volunteer_roles        enable row level security;
alter table volunteer_assignments  enable row level security;
alter table drills                 enable row level security;
alter table practice_plans         enable row level security;
alter table practice_plan_blocks   enable row level security;

create or replace function is_thread_member(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from thread_members where thread_id = t and profile_id = auth.uid());
$$;

create or replace function can_see_athlete(a uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select
    is_coach_or_owner()
    or exists (select 1 from athletes where id = a and profile_id = auth.uid())
    or exists (select 1 from parent_links where athlete_id = a and parent_id = auth.uid());
$$;

create policy "threads: members read" on message_threads for select using (is_thread_member(id));
create policy "threads: staff read program" on message_threads for select using (program_id = auth_program_id() and is_coach_or_owner());
create policy "threads: members write" on message_threads for insert with check (program_id = auth_program_id());
create policy "threads: owner/creator update" on message_threads for update using (is_thread_member(id)) with check (is_thread_member(id));

create policy "thread_members: self read" on thread_members for select using (profile_id = auth.uid() or is_thread_member(thread_id));
create policy "thread_members: staff manage" on thread_members for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "messages: members read" on messages for select using (is_thread_member(thread_id));
create policy "messages: members write" on messages for insert with check (is_thread_member(thread_id) and author_id = auth.uid());
create policy "messages: author edits" on messages for update using (author_id = auth.uid()) with check (author_id = auth.uid());

create policy "reads: self only" on message_reads for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "availability: staff all" on session_availability for all using (is_coach_or_owner()) with check (is_coach_or_owner());
create policy "availability: read linked athletes" on session_availability for select using (can_see_athlete(athlete_id));
create policy "availability: parent + athlete write own" on session_availability for insert with check (can_see_athlete(athlete_id));
create policy "availability: parent + athlete update own" on session_availability for update using (can_see_athlete(athlete_id)) with check (can_see_athlete(athlete_id));

create policy "cal tokens: self only" on calendar_tokens for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "windows: public read" on registration_windows for select using (is_public is true);
create policy "windows: staff manage" on registration_windows for all using (program_id = auth_program_id() and is_coach_or_owner()) with check (program_id = auth_program_id() and is_coach_or_owner());

create policy "registrations: public insert" on registrations for insert with check (true);
create policy "registrations: staff read/write" on registrations for all using (program_id = auth_program_id() and is_coach_or_owner()) with check (program_id = auth_program_id() and is_coach_or_owner());

create policy "waivers: program reads" on waiver_templates for select using (program_id = auth_program_id());
create policy "waivers: staff writes" on waiver_templates for all using (program_id = auth_program_id() and is_coach_or_owner()) with check (program_id = auth_program_id() and is_coach_or_owner());

create policy "sigs: public insert" on waiver_signatures for insert with check (true);
create policy "sigs: staff read" on waiver_signatures for select using (program_id = auth_program_id() and is_coach_or_owner());
create policy "sigs: linked athlete read" on waiver_signatures for select using (athlete_id is not null and can_see_athlete(athlete_id));

create policy "form_tpl: program reads" on form_templates for select using (program_id = auth_program_id());
create policy "form_tpl: staff writes" on form_templates for all using (program_id = auth_program_id() and is_coach_or_owner()) with check (program_id = auth_program_id() and is_coach_or_owner());

create policy "form_fields: reads via template" on form_fields for select using (exists (select 1 from form_templates t where t.id = template_id and t.program_id = auth_program_id()));
create policy "form_fields: staff writes" on form_fields for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "form_responses: staff all" on form_responses for all using (is_coach_or_owner()) with check (is_coach_or_owner());
create policy "form_responses: subject + parent read" on form_responses for select using (subject_athlete_id is not null and can_see_athlete(subject_athlete_id));

create policy "form_answers: reads via response" on form_answers for select using (exists (select 1 from form_responses r where r.id = response_id and (is_coach_or_owner() or (r.subject_athlete_id is not null and can_see_athlete(r.subject_athlete_id)))));
create policy "form_answers: staff write" on form_answers for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "ec: athlete visible" on emergency_contacts for select using (can_see_athlete(athlete_id));
create policy "ec: parent + staff write" on emergency_contacts for all using (can_see_athlete(athlete_id)) with check (can_see_athlete(athlete_id));

create policy "med: athlete visible" on medical_records for select using (can_see_athlete(athlete_id));
create policy "med: parent + staff write" on medical_records for all using (can_see_athlete(athlete_id)) with check (can_see_athlete(athlete_id));

create policy "injuries: athlete visible" on injuries for select using (can_see_athlete(athlete_id));
create policy "injuries: staff writes" on injuries for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "uniforms: program reads" on uniforms for select using (program_id = auth_program_id());
create policy "uniforms: owner writes" on uniforms for all using (program_id = auth_program_id() and auth_role() = 'owner') with check (program_id = auth_program_id() and auth_role() = 'owner');

create policy "uni items: program reads" on uniform_items for select using (exists (select 1 from uniforms u where u.id = uniform_id and u.program_id = auth_program_id()));
create policy "uni items: owner writes" on uniform_items for all using (auth_role() = 'owner') with check (auth_role() = 'owner');

create policy "uni orders: athlete visible" on uniform_orders for select using (can_see_athlete(athlete_id));
create policy "uni orders: staff writes" on uniform_orders for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "leads: staff only" on leads for all using (program_id = auth_program_id() and is_coach_or_owner()) with check (program_id = auth_program_id() and is_coach_or_owner());
create policy "lead touches: staff only" on lead_touches for all using (is_coach_or_owner()) with check (is_coach_or_owner());
create policy "leads: public intake" on leads for insert with check (stage = 'new');

create policy "vol roles: program reads" on volunteer_roles for select using (program_id = auth_program_id());
create policy "vol roles: staff writes" on volunteer_roles for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "vol assigns: program reads" on volunteer_assignments for select using (exists (select 1 from volunteer_roles r where r.id = role_id and r.program_id = auth_program_id()));
create policy "vol assigns: staff manage" on volunteer_assignments for all using (is_coach_or_owner()) with check (is_coach_or_owner());
create policy "vol assigns: claim as self" on volunteer_assignments for update using (profile_id = auth.uid() or status = 'open') with check (profile_id = auth.uid() or status = 'open');

create policy "drills: program reads" on drills for select using (program_id = auth_program_id());
create policy "drills: staff writes" on drills for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "plans: team visible" on practice_plans for select using (exists (select 1 from teams t where t.id = team_id and t.program_id = auth_program_id()));
create policy "plans: staff writes" on practice_plans for all using (is_coach_or_owner()) with check (is_coach_or_owner());

create policy "plan blocks: read via plan" on practice_plan_blocks for select using (exists (select 1 from practice_plans p where p.id = plan_id));
create policy "plan blocks: staff writes" on practice_plan_blocks for all using (is_coach_or_owner()) with check (is_coach_or_owner());;
