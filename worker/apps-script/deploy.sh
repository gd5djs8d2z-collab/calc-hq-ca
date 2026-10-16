#!/usr/bin/env bash
# deploy.sh — creates, pushes and deploys the lead Sheet's Apps Script with clasp.
#
# Everything with a secret in it lives OUTSIDE the repo, in ~/.calc-hq/ (the repo is public
# and its root is the Cloudflare assets directory, so a file here could be served):
#   ~/.calc-hq/lead-secrets.env     LEADS_WEBHOOK_SECRET, LEAD_TEST_TOKEN, LEADS_WEBHOOK_URL
#   ~/.calc-hq/apps-script/         clasp working copy (.clasp.json, generated Config.gs)
#
#   deploy.sh create          new Google Sheet "calc-hq leads" with this script bound to it
#   deploy.sh push-config     push Code.gs + manifest + a temporary Config.gs holding the
#                             script properties (run setup() in the editor after this)
#   deploy.sh push            push Code.gs + manifest only — removes Config.gs remotely
#   deploy.sh deploy          create the web app deployment, or update the existing one in
#                             place so its /exec URL never changes; records LEADS_WEBHOOK_URL
#
# Needs a one-time `npx @google/clasp@3.4.1 login` as the Google account that owns the Sheet.
# Env: OWNER_EMAIL (required for push-config), PARTNER_EMAIL (default ryan@ryanelliott.ca).

set -euo pipefail
read -r -a CLASP <<< "${CLASP_CMD:-npx -y @google/clasp@3.4.1}"   # CLASP_CMD: dry-run override
SRC="$(cd "$(dirname "$0")" && pwd)"
HOME_DIR="$HOME/.calc-hq"
WORK="$HOME_DIR/apps-script"
SECRETS="$HOME_DIR/lead-secrets.env"
umask 077
mkdir -p "$WORK"

secret() { sed -n "s/^$1=//p" "$SECRETS" | tail -1; }

stage() {
  cp "$SRC/Code.gs" "$SRC/appsscript.json" "$WORK/"
  rm -f "$WORK/Config.gs"
  printf '**/**\n!Code.gs\n!Config.gs\n!appsscript.json\n' > "$WORK/.claspignore"
}

case "${1:-}" in
  create)
    [ -f "$WORK/.clasp.json" ] && { echo "already created: $WORK/.clasp.json"; exit 1; }
    (cd "$WORK" && "${CLASP[@]}" create-script --type sheets --title "calc-hq leads")
    ;;
  push-config)
    : "${OWNER_EMAIL:?set OWNER_EMAIL}"
    PARTNER_EMAIL="${PARTNER_EMAIL:-ryan@ryanelliott.ca}"
    S="$(secret LEADS_WEBHOOK_SECRET)"; [ -n "$S" ] || { echo "no LEADS_WEBHOOK_SECRET in $SECRETS"; exit 1; }
    stage
    cat > "$WORK/Config.gs" <<EOF
/* Temporary — sets the script properties when setup() runs, then is removed by the next
   deploy.sh push. Generated $(date -u +%FT%TZ). */
function setupProperties_() {
  PropertiesService.getScriptProperties().setProperties({
    SHARED_SECRET: '$S',
    OWNER_EMAIL: '$OWNER_EMAIL',
    PARTNER_EMAIL: '$PARTNER_EMAIL'
  });
}
EOF
    (cd "$WORK" && "${CLASP[@]}" push --force)
    ;;
  push)
    stage
    (cd "$WORK" && "${CLASP[@]}" push --force)
    ;;
  deploy)
    if [ -f "$WORK/deployment-id" ]; then
      ID="$(cat "$WORK/deployment-id")"
      (cd "$WORK" && "${CLASP[@]}" create-deployment -i "$ID" -d "calc-hq lead webhook")
    else
      OUT="$(cd "$WORK" && "${CLASP[@]}" create-deployment -d "calc-hq lead webhook")"
      ID="$(printf '%s\n' "$OUT" | grep -o 'AKfy[A-Za-z0-9_-]*' | head -1)"
      [ -n "$ID" ] || { echo "could not read a deployment id from clasp's output"; exit 1; }
      printf '%s\n' "$ID" > "$WORK/deployment-id"
    fi
    URL="https://script.google.com/macros/s/$ID/exec"
    grep -q '^LEADS_WEBHOOK_URL=' "$SECRETS" || printf 'LEADS_WEBHOOK_URL=%s\n' "$URL" >> "$SECRETS"
    echo "web app deployed; URL recorded in $SECRETS"
    ;;
  *)
    sed -n '2,20p' "$0"; exit 1 ;;
esac
