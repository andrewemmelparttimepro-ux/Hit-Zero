-- USASF 2025-2026 style rubric mapped to the Grok report categories.
-- Weights sum to 100 pct; max_points scales to 100 total. Rules are the
-- machine-readable hints the quantification engine uses.
insert into rubric_versions (id, org, season, effective_at, total_points, is_active, notes) values
  ('ab000000-0000-0000-0000-000000000001', 'usasf', '2025-2026', '2025-08-01', 100, true,
   'Synthesized from the Grok AI Cheer Coach report: weighted per-category rubric.')
on conflict do nothing;

insert into rubric_categories (version_id, code, label, weight_pct, max_points, position, rules) values
  ('ab000000-0000-0000-0000-000000000001', 'stunts',              'Stunts',              25.00, 25.00, 0,
   jsonb_build_object('majority', 0.51, 'most', 0.75, 'max', 1.0, 'synced_bonus', 0.10)),
  ('ab000000-0000-0000-0000-000000000001', 'pyramids',            'Pyramids',            25.00, 25.00, 1,
   jsonb_build_object('majority', 0.51, 'most', 0.75, 'max', 1.0, 'connection_bonus', 0.10)),
  ('ab000000-0000-0000-0000-000000000001', 'running_tumbling',    'Running Tumbling',    12.50, 12.50, 2,
   jsonb_build_object('pass_min_pct', 0.66, 'synced_bonus', 0.10)),
  ('ab000000-0000-0000-0000-000000000001', 'standing_tumbling',   'Standing Tumbling',   12.50, 12.50, 3,
   jsonb_build_object('pass_min_pct', 0.66, 'synced_bonus', 0.10)),
  ('ab000000-0000-0000-0000-000000000001', 'jumps',               'Jumps',               12.50, 12.50, 4,
   jsonb_build_object('min_connected', 2, 'form_weight', 0.5, 'height_weight', 0.5)),
  ('ab000000-0000-0000-0000-000000000001', 'dance',               'Dance',                6.25,  6.25, 5,
   jsonb_build_object('sync_weight', 0.4, 'musicality_weight', 0.3, 'showmanship_weight', 0.3)),
  ('ab000000-0000-0000-0000-000000000001', 'routine_composition', 'Routine Composition',  6.25,  6.25, 6,
   jsonb_build_object('variety_weight', 0.5, 'flow_weight', 0.5));;
