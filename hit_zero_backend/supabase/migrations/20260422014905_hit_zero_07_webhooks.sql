create extension if not exists pg_net with schema extensions;

drop trigger if exists trg_on_skill_mastered on public.athlete_skills;

create or replace function public.fire_on_skill_mastered()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  edge_url text := current_setting('app.edge_base_url', true);
  body jsonb;
begin
  if new.status <> 'mastered' then
    return new;
  end if;
  if tg_op = 'UPDATE' and coalesce(old.status, '') = 'mastered' then
    return new;
  end if;

  body := jsonb_build_object(
    'type',       tg_op,
    'table',      tg_table_name,
    'record',     to_jsonb(new),
    'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end
  );

  if edge_url is null or edge_url = '' then
    raise notice 'fire_on_skill_mastered: app.edge_base_url not set; skipping';
    return new;
  end if;

  perform net.http_post(
    url     := edge_url || '/on-skill-mastered',
    body    := body,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.edge_anon_key', true)
    )
  );

  return new;
end;
$$;

create trigger trg_on_skill_mastered
after insert or update of status on public.athlete_skills
for each row
execute function public.fire_on_skill_mastered();

comment on function public.fire_on_skill_mastered() is 'Fires the on-skill-mastered edge function when an athlete_skills row transitions to mastered.';;
