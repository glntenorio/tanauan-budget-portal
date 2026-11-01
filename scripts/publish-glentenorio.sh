#!/bin/sh
# Build the portal for glentenorio.com/tools/tanauan-budget-portal/ and copy it
# into the portfolio repo. Commit and push the portfolio to go live (Hostinger
# deploys on push to main).
set -e
cd "$(dirname "$0")/.."
BASE=/tools/tanauan-budget-portal/
DEST="${PORTFOLIO:-$HOME/Desktop/Claude Projects/portfolio}/tools/tanauan-budget-portal"

# Pick up any change to the site's sidebar first.
node scripts/sync-gt-sidebar.mjs "${PORTFOLIO:-$HOME/Desktop/Claude Projects/portfolio}"
PORTAL_BASE=$BASE npm run build
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R dist/. "$DEST/"
cat > "$DEST/.htaccess" <<HT
# Tanauan City Budget Portal: a single-page app. Built from
# glntenorio/tanauan-budget-portal by scripts/publish-glentenorio.sh; don't edit here.
RewriteEngine On
RewriteBase $BASE
# Real files (hashed assets, og.jpg, favicon) are served as they are.
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
# Every other path (/gaa, /about, /projects/...) is a route in the app.
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
  # The page itself always revalidates, so a new build shows up at once.
  <FilesMatch "\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
HT
echo "Copied to $DEST"
