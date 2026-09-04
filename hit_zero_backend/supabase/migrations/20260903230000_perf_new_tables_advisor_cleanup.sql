-- Re-run the performance hardening added in July for tables introduced later.
-- `(select auth.uid())` is evaluated once per statement instead of per row.

alter policy agent_config_update on public.agent_config
  using (
    org_id = public.auth_program_id()
    and (select role from public.profiles where id = (select auth.uid())) = 'owner'
  );

alter policy agent_threads_own on public.agent_threads
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy agent_messages_own on public.agent_messages
  using (
    exists (
      select 1
      from public.agent_threads t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.agent_threads t
      where t.id = thread_id
        and t.user_id = (select auth.uid())
    )
  );

-- Cover the six foreign keys introduced after the original FK index pass.
create index if not exists agent_config_updated_by_idx
  on public.agent_config (updated_by);

create index if not exists agent_threads_user_id_idx
  on public.agent_threads (user_id);

create index if not exists teams_source_class_id_idx
  on public.teams (source_class_id);

create index if not exists team_assignment_events_from_team_id_idx
  on public.team_assignment_events (from_team_id);

create index if not exists team_assignment_events_to_team_id_idx
  on public.team_assignment_events (to_team_id);

create index if not exists team_assignment_events_changed_by_idx
  on public.team_assignment_events (changed_by);
