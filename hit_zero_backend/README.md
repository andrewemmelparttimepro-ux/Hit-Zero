# Hit Zero — Backend

Supabase project: Postgres 15 + Auth + Realtime + Storage.

## Structure

```
supabase/
  migrations/           Versioned SQL — applied in filename order
    20260420000001_initial_schema.sql
    20260420000002_auth_triggers.sql
    20260420000003_rls_policies.sql
    20260420000004_realtime.sql
    20260420000005_storage_buckets.sql
    20260420000006_seed_skills.sql
  seed.sql              Dev-only demo data
  config.toml           Local Supabase CLI config
functions/              Edge Functions (TypeScript)
  on-skill-mastered/    Pushes notification when athlete masters a skill
  nightly-digest/       Weekly "here's what you missed" email to parents
```

## Local dev

```bash
# one-time
brew install supabase/tap/supabase
supabase login

# in this folder
supabase init
supabase start              # runs Postgres + Studio + Auth locally
supabase db reset           # applies all migrations + seed.sql
```

Local Studio at http://localhost:54323, API at http://localhost:54321.

## Deploying

```bash
# one-time per environment
supabase link --project-ref <staging-ref>
supabase db push            # pushes migrations

# edge functions
supabase functions deploy on-skill-mastered
supabase secrets set APNS_KEY_ID=... FCM_KEY=...
```

## Environments

- **dev** — local Supabase (`supabase start`)
- **staging** — `hitzero-staging` on supabase.com (free tier ok)
- **prod** — `hitzero-prod` on supabase.com (Pro plan, $25/mo, needed for daily backups + custom domain)

## Schema invariants

- `auth.users.id` = `profiles.id` (1:1, enforced by FK + trigger)
- Every data row is scoped to a `program_id` or transitively to one
- RLS is always on. If a query fails with "permission denied", the fix is a policy, not a service-role key in the client.
