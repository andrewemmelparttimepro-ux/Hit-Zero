alter table public.celebrations add column if not exists source_event_key text;
create unique index if not exists celebrations_source_event_key on public.celebrations(source_event_key) where source_event_key is not null;
create or replace function public.fire_on_skill_mastered()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  edge_url text := current_setting('app.edge_base_url', true);
  body jsonb;
  webhook_secret text;
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

  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name='hitzero_skill_webhook' limit 1;
  if webhook_secret is null then raise notice 'Skill webhook secret missing; delivery skipped'; return new; end if;
  perform net.http_post(
    url     := edge_url || '/on-skill-mastered',
    body    := body,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-hz-webhook-key', webhook_secret
    )
  );

  return new;
end;
$$;

