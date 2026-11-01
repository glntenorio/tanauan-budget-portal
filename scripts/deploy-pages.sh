#!/bin/sh
# Build and deploy to Cloudflare Pages (tanauan-budget-portal.pages.dev, personal account).
# Wrangler 3: 4.151+ sends Pages commands to Workers. wrangler.jsonc is the
# upstream Workers config, so it steps aside during the upload.
set -e
cd "$(dirname "$0")/.."
npm run build
mv wrangler.jsonc wrangler.jsonc.off
trap 'mv wrangler.jsonc.off wrangler.jsonc' EXIT
npx -y wrangler@3 pages deploy dist --project-name tanauan-budget-portal --branch main --commit-dirty=true
