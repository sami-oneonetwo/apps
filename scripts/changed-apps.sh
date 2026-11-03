#!/usr/bin/env bash
# Print a JSON array of app folder names under apps/ that changed between two commits.
# Usage: changed-apps.sh <base-sha|""> <head-sha>
# An empty or all-zero base, or a change to shared files, means "all apps".
set -euo pipefail

base="${1:-}"
head="${2:-HEAD}"

all_apps() {
  for d in apps/*/; do
    [[ -f "${d}wrangler.jsonc" || -f "${d}wrangler.toml" || -f "${d}wrangler.json" ]] && basename "$d"
  done
}

to_json() {
  local first=1
  printf '['
  while read -r a; do
    [[ -z "$a" ]] && continue
    if [[ $first -eq 0 ]]; then printf ','; fi
    printf '"%s"' "$a"; first=0
  done
  printf ']\n'
}

if [[ -z "$base" || "$base" =~ ^0+$ ]] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  all_apps | sort -u | to_json; exit 0
fi

changed="$(git diff --name-only "$base" "$head")"

# Shared files affect every app.
if grep -qE '^(package\.json|package-lock\.json|\.github/workflows/deploy\.yml|scripts/changed-apps\.sh)$' <<<"$changed"; then
  all_apps | sort -u | to_json; exit 0
fi

existing="$(all_apps)"
grep -oE '^apps/[^/]+/' <<<"$changed" | cut -d/ -f2 | sort -u | while read -r a; do
  # Skip deleted apps (still in the diff, gone from the tree).
  grep -qx "$a" <<<"$existing" && echo "$a"
done | to_json
