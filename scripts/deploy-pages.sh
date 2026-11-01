#!/bin/sh
# tanauan-budget-portal.pages.dev now only redirects: the portal is hosted at
# glentenorio.com/tools/tanauan-budget-portal/ (npm run publish:glentenorio).
# Wrangler 3: 4.151+ sends Pages commands to Workers.
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
printf '/* https://glentenorio.com/tools/tanauan-budget-portal/:splat 301\n' > "$OUT/_redirects"
printf '<!doctype html><meta http-equiv="refresh" content="0;url=https://glentenorio.com/tools/tanauan-budget-portal/"><link rel="canonical" href="https://glentenorio.com/tools/tanauan-budget-portal/">\n' > "$OUT/index.html"
mv wrangler.jsonc wrangler.jsonc.off
trap 'mv wrangler.jsonc.off wrangler.jsonc; rm -rf "$OUT"' EXIT
npx -y wrangler@3 pages deploy "$OUT" --project-name tanauan-budget-portal --branch main --commit-dirty=true
