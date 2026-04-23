create or replace function handle_new_user() returns trigger
security definer set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'role', 'parent');
  v_program_id uuid := nullif(new.raw_user_meta_data->>'program_id','')::uuid;
  v_name text := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1));
begin
  insert into public.profiles (id, email, role, program_id, display_name)
  values (new.id, new.email, v_role, v_program_id, v_name);
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function handle_user_email_change() returns trigger
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_email_change on auth.users;
create trigger on_auth_user_email_change
  after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function handle_user_email_change();

create or replace function auth_role() returns text
security definer set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$ language sql stable;

create or replace function auth_program_id() returns uuid
security definer set search_path = public
as $$
  select program_id from profiles where id = auth.uid()
$$ language sql stable;

create or replace function is_coach_or_owner() returns boolean
security definer set search_path = public
as $$
  select auth_role() in ('coach','owner')
$$ language sql stable;

create or replace function is_program_staff(p_program uuid) returns boolean
security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and program_id = p_program and role in ('coach','owner'))
$$ language sql stable;

create or replace function is_linked_parent(p_athlete uuid) returns boolean
security definer set search_path = public
as $$
  select exists (select 1 from parent_links where parent_id = auth.uid() and athlete_id = p_athlete)
$$ language sql stable;

create or replace function is_own_athlete(p_athlete uuid) returns boolean
security definer set search_path = public
as $$
  select exists (select 1 from athletes where id = p_athlete and profile_id = auth.uid())
$$ language sql stable;

create or replace function is_teammate(p_athlete uuid) returns boolean
security definer set search_path = public
as $$
  select exists (select 1 from athletes me join athletes them on them.team_id = me.team_id where me.profile_id = auth.uid() and them.id = p_athlete)
$$ language sql stable;

create or replace function program_of_athlete(p_athlete uuid) returns uuid
security definer set search_path = public
as $$
  select t.program_id from athletes a join teams t on t.id = a.team_id where a.id = p_athlete
$$ language sql stable;

create or replace function program_of_team(p_team uuid) returns uuid
security definer set search_path = public
as $$
  select program_id from teams where id = p_team
$$ language sql stable;;
