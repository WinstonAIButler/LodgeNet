#!/usr/bin/env bash
# Moves every hard-coded public URL (canonicals, og tags, JSON-LD, sitemap,
# robots.txt, llms.txt, the importer's user agent) to a new domain.
#   scripts/set-domain.sh https://www.example.com
# The current domain is read from SITE_URL below, which this script updates too.
set -euo pipefail
SITE_URL="https://www.lodgenet.app"
new="${1:?usage: scripts/set-domain.sh https://new.domain}"
new="${new%/}"
cd "$(dirname "$0")/.."
files=$(grep -rlF "$SITE_URL" --include='*.html' --include='*.xml' --include='*.txt' --include='*.js' --include='*.md' --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=vendor . || true)
for f in $files; do sed -i.bak "s#${SITE_URL//./\\.}#${new}#g" "$f" && rm -f "$f.bak"; done
sed -i.bak "s#^SITE_URL=\".*\"#SITE_URL=\"${new}\"#" scripts/set-domain.sh && rm -f scripts/set-domain.sh.bak
echo "Moved ${SITE_URL} -> ${new}. Also update the host redirect in vercel.json."
