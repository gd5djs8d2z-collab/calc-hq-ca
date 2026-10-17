#!/usr/bin/env bash
# check-lead-health.sh — is the live lead form able to deliver a lead right now?
#
#   LEAD_HEALTH_TOKEN=… scripts/check-lead-health.sh
#   env: SITE (default https://calc-hq.ca), ATTEMPTS (default 1), WAIT seconds between attempts
#
# Three checks, none of which creates, reads or deletes a lead:
#   1. GET /api/lead answers 405 from the Worker — the Worker is deployed (a 404 page means
#      the site went back to static files only).
#   2. A block page still loads /assets/js/lead-block.js — the form is on the page.
#   3. GET /api/lead/health with LEAD_HEALTH_TOKEN answers {"ok":true} — the Worker holds its
#      secrets, the Apps Script answers and accepts the shared secret, a row is really written
#      to the Leads tab and deleted again, and MailApp still has quota (nothing is emailed).
# Run by .github/workflows/lead-health.yml hourly and after every deploy to main.

set -uo pipefail
SITE="${SITE:-https://calc-hq.ca}"
ATTEMPTS="${ATTEMPTS:-1}"
WAIT="${WAIT:-20}"
: "${LEAD_HEALTH_TOKEN:?set LEAD_HEALTH_TOKEN}"
TMP="$(mktemp)"; trap 'rm -f "$TMP"' EXIT

explain() {   # $1 = HTTP status, $2 = body of /api/lead/health
  local detail; detail=$(printf '%s' "$2" | sed -n 's/.*"detail":"\([^"]*\)".*/\1/p')
  case "$1:$2" in
    200:*'"ok":true'*)                 echo "" ;;
    404:*) echo "health endpoint refused the token (404). Either LEAD_HEALTH_TOKEN differs between GitHub and the Worker, or the Worker lost its secrets in a deploy — run 'wrangler versions view <active id> --name calc-hq-ca' and re-set them (MAINTENANCE.md, lead form section)." ;;
    503:*secrets_missing*)             echo "the Worker has no LEADS_WEBHOOK_URL / LEADS_WEBHOOK_SECRET — re-set them from ~/.calc-hq/lead-secrets.env." ;;
    502:*webhook_secret_rejected*)     echo "the Apps Script rejected the shared secret — LEADS_WEBHOOK_SECRET no longer matches the script's SHARED_SECRET property." ;;
    502:*webhook_unreachable*)         echo "the Apps Script web app did not answer — wrong LEADS_WEBHOOK_URL, a deleted deployment, or Google is down." ;;
    502:*apps_script_outdated*)        echo "the deployed Apps Script has no 'health' action — run worker/apps-script/deploy.sh push, then deploy." ;;
    502:*sheet_write_failed*)          echo "the Apps Script could not write a row to the Leads tab — real leads are not being stored. Google says: ${detail:-no detail}" ;;
    502:*sheet_cleanup_failed*)        echo "a health-check row was written but could not be deleted — check the Leads tab for an L-HEALTH row (${detail:-no detail})." ;;
    502:*mail_unavailable*)            echo "the Apps Script lost its send-mail permission — rows are stored but no emails go out. Open the script and run setup() to re-authorize." ;;
    502:*mail_quota_exhausted*)        echo "MailApp's daily quota is used up — rows are stored but no emails go out until it resets." ;;
    *)                                 echo "unexpected answer from /api/lead/health: HTTP $1 $2" ;;
  esac
}

for i in $(seq 1 "$ATTEMPTS"); do
  problems=()

  code=$(curl -s -o "$TMP" -w '%{http_code}' --max-time 20 "$SITE/api/lead")
  [ "$code" = 405 ] || problems+=("GET /api/lead answered $code, not the Worker's 405 — the Worker may not be deployed.")

  code=$(curl -s -o "$TMP" -w '%{http_code}' --max-time 20 "$SITE/payroll/take-home-pay/")
  { [ "$code" = 200 ] && grep -q 'lead-block.js' "$TMP"; } || problems+=("/payroll/take-home-pay/ answered $code without the lead form script.")

  code=$(curl -s -o "$TMP" -w '%{http_code}' --max-time 40 -H "Authorization: Bearer $LEAD_HEALTH_TOKEN" "$SITE/api/lead/health")
  why=$(explain "$code" "$(cat "$TMP")")
  [ -z "$why" ] || problems+=("$why")

  if [ ${#problems[@]} -eq 0 ]; then
    echo "lead form healthy: Worker deployed, form on the page, secrets bound, test row written and deleted, mail quota $(sed -n 's/.*"mail_quota":\([0-9]*\).*/\1/p' "$TMP") ($SITE)"
    exit 0
  fi
  echo "attempt $i/$ATTEMPTS failed:"; printf '  - %s\n' "${problems[@]}"
  [ "$i" -lt "$ATTEMPTS" ] && sleep "$WAIT"
done

echo "LEAD FORM NOT WORKING on $SITE — see the reasons above." >&2
exit 1
