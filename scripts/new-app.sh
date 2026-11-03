#!/usr/bin/env bash
# Create apps/<name> from templates/worker.
# Usage: npm run new-app -- <name>    (or: bash scripts/new-app.sh <name>)
set -euo pipefail

name="${1:-}"
root="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "$name" ]]; then
  echo "usage: new-app.sh <name>" >&2; exit 1
fi
# Lowercase DNS label; "-preview" is appended, so keep room under 63 chars.
if ! [[ "$name" =~ ^[a-z][a-z0-9-]{0,45}$ ]] || [[ "$name" == *- ]]; then
  echo "invalid name '$name': use lowercase letters, digits and dashes, start with a letter, max 46 chars" >&2
  exit 1
fi
if [[ "$name" == *-preview ]]; then
  echo "invalid name '$name': '-preview' suffix is reserved" >&2; exit 1
fi

dest="$root/apps/$name"
if [[ -e "$dest" ]]; then
  echo "apps/$name already exists" >&2; exit 1
fi

cp -R "$root/templates/worker" "$dest"
grep -rl "__APP__" "$dest" | while read -r f; do
  sed -i.bak "s/__APP__/$name/g" "$f" && rm -f "$f.bak"
done

echo "Created apps/$name"
echo "  prod:    https://$name.apps.fatherbean.com"
echo "  preview: https://$name-preview.apps.fatherbean.com"
