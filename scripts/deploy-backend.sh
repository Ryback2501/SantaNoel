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
# untouched: the code is copied to a temporary folder with its own .clasp.json.
set -euo pipefail

: "${APPS_SCRIPT_ID:?APPS_SCRIPT_ID is not set}"
: "${APPS_SCRIPT_DEPLOYMENT_ID:?APPS_SCRIPT_DEPLOYMENT_ID is not set}"

CLASP=(npx --yes @google/clasp@3.4.1)
root=$(cd "$(dirname "$0")/.." && pwd)
version=$(node -p "require('$root/package.json').version")

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cp -R "$root/apps-script/." "$work/"
printf '{ "scriptId": "%s", "rootDir": "" }\n' "$APPS_SCRIPT_ID" > "$work/.clasp.json"

cd "$work"
"${CLASP[@]}" push --force
"${CLASP[@]}" create-deployment -i "$APPS_SCRIPT_DEPLOYMENT_ID" -d "v$version"
echo "Backend v$version deployed to the existing production web app."
