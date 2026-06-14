-- Switch the public directory view to security_invoker so it enforces the
-- caller's RLS instead of the creator's. The underlying programs table is
-- public-readable for is_public=true rows already, so this is the safer
-- posture and clears the security_definer_view advisor.

alter view public.program_public_directory set (security_invoker = on);

-- Make sure both anon and authenticated can still read the (already-filtered)
-- view explicitly.
grant select on public.program_public_directory to anon, authenticated;
