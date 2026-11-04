#!/usr/bin/env bash
# Copy the shared house style into every app (CI does this on deploy; run it for local dev).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
for d in "$root"/apps/*/public; do
  rm -rf "$d/house" && cp -R "$root/shared/house" "$d/house"
done
echo "house style copied into $(ls -d "$root"/apps/*/public | wc -l | tr -d ' ') apps"
