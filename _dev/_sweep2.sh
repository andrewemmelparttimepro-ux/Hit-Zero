#!/bin/bash
set -u
PATH=/usr/bin:/bin:/usr/local/bin
cd /Users/andrewemmel/Desktop/hitzero/_raw

BASE="https://3f2542b4-e2e3-46ad-be3f-f5427362e0e0.claudeusercontent.com/v1/design/projects/3f2542b4-e2e3-46ad-be3f-f5427362e0e0/serve"
TOKEN="64b591773d19e81df13ccccc5e8e91df9edbc6313b9d28b1dc05ecae8200f218.f1b81093-8db2-4e6e-aa68-803de8fca173.5ab700b0-93a3-4674-b1e0-621838319d2a.1776733361"

fetch() {
  local url_path="$1"
  local local_path
  local_path=$(printf '%b' "${url_path//%/\\x}")
  mkdir -p "$(dirname "$local_path")" 2>/dev/null || true
  code=$(curl -s -o "$local_path" -w "%{http_code}" "$BASE/$url_path?t=$TOKEN")
  size=$(wc -c < "$local_path" | tr -d ' ')
  if [[ "$code" == "200" && "$size" -gt 0 ]]; then
    printf "%s %8s  %s\n" "$code" "$size" "$local_path"
  else
    rm -f "$local_path"
    printf "MISS    %s\n" "$local_path" 1>&2
  fi
}

# Per HANDOFF.md file tree
FILES=(
  "hit_zero_backend/supabase/migrations/20260420000001_initial_schema.sql"
  "hit_zero_backend/supabase/migrations/20260420000002_auth_triggers.sql"
  "hit_zero_backend/supabase/migrations/20260420000003_rls_policies.sql"
  "hit_zero_backend/supabase/migrations/20260420000004_realtime.sql"
  "hit_zero_backend/supabase/migrations/20260420000005_storage_buckets.sql"
  "hit_zero_backend/supabase/migrations/20260420000006_seed_skills.sql"
  "hit_zero_backend/functions/on-skill-mastered/index.ts"
  "hit_zero_backend/functions/on-skill-mastered/deno.json"
  "hit_zero_client/.env.example"
  "hit_zero_client/src/styles.css"
  "hit_zero_client/src/lib/native.ts"
  "hit_zero_client/src/lib/store.ts"
  "hit_zero_client/src/screens/AuthScreen.tsx"
  "hit_zero_client/src/screens/VideoRecorder.tsx"
  "hit_zero_client/src/screens/VideoReview.tsx"
  "hit_zero_client/README.md"
  # Re-grab now with correct token in case first sweep was stale
  "HANDOFF.md"
  "README.md"
  "hit_zero_backend/README.md"
)

for p in "${FILES[@]}"; do fetch "$p"; done
