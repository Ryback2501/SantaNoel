#!/usr/bin/env bash
# Pushes apps-script/ to the production Apps Script project and updates its existing web app
# deployment in place, so the production backend URL never changes between releases.
#
# Needs:
#   APPS_SCRIPT_ID             the production script ID
#   APPS_SCRIPT_DEPLOYMENT_ID  the production web app deployment ID
#   ~/.clasprc.json            clasp credentials (the release workflow writes it from the
#                              CLASPRC_JSON secret and removes it afterwards)
#
# It never prints the credentials. apps-script/.clasp.json (the development project) is left
# untouched: the code is copied to a temporary folder, whose copy of .clasp.json gets the
# production script ID.
set -euo pipefail

: "${APPS_SCRIPT_ID:?APPS_SCRIPT_ID is not set}"
: "${APPS_SCRIPT_DEPLOYMENT_ID:?APPS_SCRIPT_DEPLOYMENT_ID is not set}"

CLASP=(npx --yes @google/clasp@3.4.1)
root=$(cd "$(dirname "$0")/.." && pwd)
version=$(node -p 'require(process.argv[1]).version' "$root/package.json")

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -R "$root/apps-script/." "$work/"
# Same clasp settings as development; only the script ID changes.
node -e 'const fs = require("fs"); const [file, id] = process.argv.slice(1);
const config = JSON.parse(fs.readFileSync(file, "utf8")); config.scriptId = id;
fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");' "$work/.clasp.json" "$APPS_SCRIPT_ID"

cd "$work"
"${CLASP[@]}" push --force
"${CLASP[@]}" create-deployment -i "$APPS_SCRIPT_DEPLOYMENT_ID" -d "v$version"
echo "Backend v$version deployed to the existing production web app."
