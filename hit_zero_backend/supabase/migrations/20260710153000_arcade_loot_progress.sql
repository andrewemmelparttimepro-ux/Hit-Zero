-- ARCADE loot & progression — durable per-athlete progress for the Cheer
-- Town expansion: hidden-treasure finds + play-time Spirit Stars.
--   progress jsonb: { found: {itemId: count}, playSeconds: n,
--                     days: {'YYYY-MM-DD': [spotIds]} }
-- Additive only. Existing own-row RLS on arcade_profiles already covers it;
-- movement/position/chat remain never-persisted (aggregate seconds only).

alter table public.arcade_profiles
  add column if not exists progress jsonb not null default '{}'::jsonb;
