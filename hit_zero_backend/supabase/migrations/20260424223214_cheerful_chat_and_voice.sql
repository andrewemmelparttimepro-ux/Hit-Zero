-- Chat messages — persistent log for parent review (exposed via Hit Zero later).
create table public.cheerful_chat_messages (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  display_name text not null,
  text        text not null,
  world_x     real,
  world_y     real,
  world_z     real,
  sent_at     timestamptz not null default now()
);
create index cheerful_chat_athlete_time_idx on public.cheerful_chat_messages (athlete_id, sent_at desc);
create index cheerful_chat_time_idx         on public.cheerful_chat_messages (sent_at desc);

-- Voice messages — short async clips, URL to storage.
create table public.cheerful_voice_messages (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references public.athletes(id) on delete cascade,
  display_name text not null,
  storage_path text not null,            -- path in cheerful-voice bucket
  duration_ms int not null,
  world_x     real,
  world_y     real,
  world_z     real,
  sent_at     timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);
create index cheerful_voice_athlete_time_idx on public.cheerful_voice_messages (athlete_id, sent_at desc);
create index cheerful_voice_expiry_idx       on public.cheerful_voice_messages (expires_at);

alter table public.cheerful_chat_messages  enable row level security;
alter table public.cheerful_voice_messages enable row level security;

-- No public policies — service_role only (Cheerful server + future Hit Zero parent UI via RPC).

-- Private storage bucket for audio clips (10-sec opus/webm, 24h expiry enforced by cleanup job).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cheerful-voice', 'cheerful-voice', false, 262144, array['audio/webm','audio/ogg','audio/mp4'])
on conflict (id) do nothing;

comment on table public.cheerful_chat_messages  is 'Persistent chat log for parent review in Hit Zero.';
comment on table public.cheerful_voice_messages is 'Short async voice clips — 10s max, 24h auto-expire, reviewable by parents.';
;
