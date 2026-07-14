-- Covers the profile_id foreign key for profile deletion/cascade lookups.
create index arcade_high_scores_profile_idx
  on public.arcade_high_scores (profile_id);
