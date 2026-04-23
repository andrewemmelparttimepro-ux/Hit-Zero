#!/bin/bash
# Aggressively probe the Claude Design serve endpoint for every file referenced
# anywhere in the project, or that we guess exists.
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
  fi
}

# Known from references in Hit Zero.html / Hit Zero Web.html
KNOWN=(
  "HANDOFF.md"
  "README.md"
  "Design%20System.md"
  "Design%20Files.md"
  "hit_zero_client/README.md"
  "hit_zero_backend/README.md"
  "hit_zero_client/package.json"
  "hit_zero_backend/package.json"
  "hit_zero_backend/supabase/config.toml"
  "hit_zero/styles/web.css"
  "hit_zero_web/styles/tokens.css"
)

for p in "${KNOWN[@]}"; do fetch "$p"; done

# Probe common paths for iOS/native Capacitor + Supabase layout
declare -a GUESSES=(
  # Docs & config
  "PLAN.md" "ROADMAP.md" "ARCHITECTURE.md" "NOTES.md" "CHANGELOG.md"
  "package.json" "tsconfig.json" ".gitignore"
  # hit_zero_client (Capacitor / React Native scaffolding)
  "hit_zero_client/tsconfig.json"
  "hit_zero_client/capacitor.config.ts"
  "hit_zero_client/capacitor.config.json"
  "hit_zero_client/vite.config.ts"
  "hit_zero_client/index.html"
  "hit_zero_client/src/main.tsx"
  "hit_zero_client/src/main.ts"
  "hit_zero_client/src/App.tsx"
  "hit_zero_client/src/index.tsx"
  "hit_zero_client/src/lib/supabase.ts"
  "hit_zero_client/src/lib/db.ts"
  "hit_zero_client/src/hooks/useAuth.ts"
  "hit_zero_client/src/screens/CoachToday.tsx"
  "hit_zero_client/src/screens/Roster.tsx"
  "hit_zero_client/src/screens/SkillMatrix.tsx"
  "hit_zero_client/src/screens/RoutineBuilder.tsx"
  "hit_zero_client/src/screens/MockScore.tsx"
  "hit_zero_client/src/screens/AthleteReel.tsx"
  "hit_zero_client/src/components/HZShell.tsx"
  "hit_zero_client/src/components/HZIcon.tsx"
  "hit_zero_client/src/components/HZWordmark.tsx"
  "hit_zero_client/src/styles/tokens.css"
  "hit_zero_client/ios/App/App/Info.plist"
  "hit_zero_client/android/app/build.gradle"
  # hit_zero_backend (Supabase)
  "hit_zero_backend/supabase/seed.sql"
  "hit_zero_backend/supabase/migrations/0001_init.sql"
  "hit_zero_backend/supabase/migrations/0002_rls.sql"
  "hit_zero_backend/supabase/functions/verify_fork/index.ts"
  "hit_zero_backend/schema.sql"
  "hit_zero_backend/migrations/001_init.sql"
  # hit_zero prototype extras
  "hit_zero/screens/SkillMatrix.jsx"
  "hit_zero/screens/AthleteHome.jsx"
  "hit_zero/screens/ParentHome.jsx"
  "hit_zero/data/seed.js"
  "hit_zero/data/skills.js"
  "hit_zero/data/teams.js"
  # hit_zero_web extras
  "hit_zero_web/screens/Sessions.jsx"
  "hit_zero_web/screens/Announcements.jsx"
  "hit_zero_web/components/AthleteRow.jsx"
  "hit_zero_web/components/SkillCell.jsx"
  "hit_zero_web/components/CheckSkillDrawer.jsx"
  # uploads (screenshots / reference images)
  "uploads/README.md"
)

for p in "${GUESSES[@]}"; do fetch "$p"; done
