-- Guard public and staff-assisted class registrations against age-ineligible
-- DOB/class combinations. The public UI and edge function both validate this,
-- but the database guard keeps payment/roster orchestration honest even if a
-- stale client or future intake path misses the check.

create or replace function public.trg_validate_registration_class_age()
returns trigger
language plpgsql
as $$
declare
  v_class record;
  v_age int;
begin
  if new.class_id is null or new.athlete_dob is null then
    return new;
  end if;

  select id, name, age_range_min, age_range_max
    into v_class
  from public.program_classes
  where id = new.class_id;

  if not found then
    return new;
  end if;

  if v_class.age_range_min is null and v_class.age_range_max is null then
    return new;
  end if;

  v_age := extract(year from age(current_date, new.athlete_dob))::int;
  if (v_class.age_range_min is not null and v_age < v_class.age_range_min)
     or (v_class.age_range_max is not null and v_age > v_class.age_range_max) then
    raise exception 'Athlete age % is not eligible for % (allowed age range: %-%)',
      v_age,
      coalesce(v_class.name, 'this class'),
      coalesce(v_class.age_range_min::text, '0'),
      coalesce(v_class.age_range_max::text, 'up')
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_registrations_validate_class_age on public.registrations;
create trigger trg_registrations_validate_class_age
  before insert or update of class_id, athlete_dob on public.registrations
  for each row
  execute function public.trg_validate_registration_class_age();

revoke execute on function public.trg_validate_registration_class_age() from anon, authenticated;
