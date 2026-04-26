-- Let athlete accounts keep their own skill tracker current.
-- Staff still retain full access via the existing staff policy.
drop policy if exists "askill: athlete updates own tracker" on athlete_skills;
create policy "askill: athlete updates own tracker"
  on athlete_skills
  for insert
  with check (
    is_own_athlete(athlete_id)
    and updated_by = auth.uid()
  );

drop policy if exists "askill: athlete edits own tracker" on athlete_skills;
create policy "askill: athlete edits own tracker"
  on athlete_skills
  for update
  using (is_own_athlete(athlete_id))
  with check (
    is_own_athlete(athlete_id)
    and updated_by = auth.uid()
  );
