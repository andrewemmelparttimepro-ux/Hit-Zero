#!/bin/bash
set -e
PATH=/usr/bin:/bin:/usr/local/bin
cd /Users/andrewemmel/Desktop/hitzero/_raw
BASE="https://3f2542b4-e2e3-46ad-be3f-f5427362e0e0.claudeusercontent.com/v1/design/projects/3f2542b4-e2e3-46ad-be3f-f5427362e0e0/serve"
TOKEN="d87853f47f27bad95bd19643b08af12fe30cf143913b643534ad94a3f30c625b.f1b81093-8db2-4e6e-aa68-803de8fca173.5ab700b0-93a3-4674-b1e0-621838319d2a.1776698302"

FILES=(
  "hit_zero/styles/tokens.css"
  "hit_zero/data/store.js"
  "hit_zero/components/HZIcon.jsx"
  "hit_zero/components/HZWordmark.jsx"
  "hit_zero/components/HZShell.jsx"
  "hit_zero/screens/CoachToday.jsx"
  "hit_zero/screens/Roster.jsx"
  "hit_zero/screens/RoutineBuilder.jsx"
  "hit_zero/screens/MockScore.jsx"
  "hit_zero/screens/AthleteReel.jsx"
)

for path in "${FILES[@]}"; do
  # URL-decode
  local_path=$(printf '%b' "${path//%/\\x}")
  mkdir -p "$(dirname "$local_path")" 2>/dev/null || true
  code=$(curl -s -o "$local_path" -w "%{http_code}" "$BASE/$path?t=$TOKEN")
  size=$(wc -c < "$local_path" | tr -d ' ')
  printf "%s %8s  %s\n" "$code" "$size" "$local_path"
done
