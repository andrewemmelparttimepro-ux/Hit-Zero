alter table public.medical_records add column if not exists provenance_review_required boolean not null default false;
alter table public.medical_records add column if not exists provenance_review_reason text;
create or replace function public.preserve_family_record_review() returns trigger
language plpgsql set search_path=public as $$
begin
 if old.provenance_review_required and current_setting('app.verified_family_review',true) is distinct from 'true' then
  new.provenance_review_required:=true;new.provenance_review_reason:=old.provenance_review_reason;
 end if;
 return new;
end $$;
create trigger preserve_family_record_review before update on public.medical_records for each row execute function public.preserve_family_record_review();
revoke execute on function public.preserve_family_record_review() from public,anon,authenticated;
