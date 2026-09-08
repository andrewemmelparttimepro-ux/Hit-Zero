begin;
-- Browsers save through the atomic, actor-checked RPC. They cannot forge or
-- partially rewrite the persisted score receipt or its deduction details.
revoke all on public.score_runs,public.score_deductions from public,anon;
revoke insert,update,delete,truncate,references,trigger on public.score_runs,public.score_deductions from authenticated;
grant select on public.score_runs,public.score_deductions to authenticated;
commit;
