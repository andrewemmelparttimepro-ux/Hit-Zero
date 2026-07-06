-- Let linked parents manage their kids' skill trackers from the Skill Tree.
-- Mirrors the athlete self-tracker policies (20260424000001) with the
-- is_linked_parent guard. Staff policies unchanged; parents still cannot
-- touch athletes they are not linked to.

drop policy if exists "askill: parent updates linked tracker" on athlete_skills;
create policy "askill: parent updates linked tracker"
  on athlete_skills
  for insert
  with check (
    is_linked_parent(athlete_id)
    and updated_by = auth.uid()
  );

drop policy if exists "askill: parent edits linked tracker" on athlete_skills;
create policy "askill: parent edits linked tracker"
  on athlete_skills
  for update
  using (is_linked_parent(athlete_id))
  with check (
    is_linked_parent(athlete_id)
    and updated_by = auth.uid()
  );
