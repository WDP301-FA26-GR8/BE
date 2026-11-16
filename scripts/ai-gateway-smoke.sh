 #!/usr/bin/env bash
 set -euo pipefail
 
 # ai-gateway-smoke.sh: Automated verification harness for BE <-> AI-service gateway
 # Does not leak tokens or passwords in output.
 
 DIRECT_MODE=false
 if [ "${1:-}" = "--direct" ]; then
   DIRECT_MODE=true
 fi
 
 # A cold Modal front answers /healthz in 5-10 s (CPU container start): hence -m 30 on the healthz checks.
# Every BE controller is versioned (`version: '1'` + URI versioning): the base carries /v1.
BE_URL="${BE_URL:-http://127.0.0.1:4000/api/v1}"
AI_URL="${AI_URL:-http://127.0.0.1:8000}"
EXPECT="${EXPECT:-ok}"

SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL:-}"
SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD:-}"
MANAGER_EMAIL="${MANAGER_EMAIL:-}"
MANAGER_PASSWORD="${MANAGER_PASSWORD:-}"

AI_SERVICE_TOKEN="${AI_SERVICE_TOKEN:-}"

 log_step() {
   printf '[%s] %s\n' "$1" "$2"
 }
 
 fail() {
   printf 'FAIL [%s]: %s\n' "$1" "$2" >&2
   exit 1
 }
 
 assert_non_empty() {
   local val="$1"
   local name="$2"
  if [ -z "$val" ] || [ "$val" = "null" ]; then
    fail "ASSERTION" "$name must not be empty or null"
  fi
}

ERR_FILE="$(mktemp)"
cleanup() {
  rm -f "$ERR_FILE"
}
trap cleanup EXIT

# ==============================================================================
# DIRECT MODE: Test AI-service standalone directly against Contract v1
 # ==============================================================================
 if [ "$DIRECT_MODE" = true ]; then
   log_step "DIRECT" "Testing AI service at $AI_URL directly"
 
   # D1: healthz
   log_step "D1" "GET $AI_URL/healthz"
   HEALTH_RES=$(curl -sS -f -m 30 "$AI_URL/healthz" 2>&1) || fail "D1" "Failed to connect to $AI_URL/healthz"
   STATUS=$(echo "$HEALTH_RES" | jq -r '.status // empty')
   MODEL_ID=$(echo "$HEALTH_RES" | jq -r '.modelId // empty')
   PROMPT_VER=$(echo "$HEALTH_RES" | jq -r '.promptVersion // empty')
   assert_non_empty "$STATUS" "healthz.status"
   assert_non_empty "$MODEL_ID" "healthz.modelId"
  assert_non_empty "$PROMPT_VER" "healthz.promptVersion"
  log_step "D1" "PASS (status=$STATUS modelId=$MODEL_ID promptVersion=$PROMPT_VER)"

  # Require AI_SERVICE_TOKEN in shell env for Contract v1 check
  if [ -z "$AI_SERVICE_TOKEN" ]; then
    fail "DIRECT" "AI_SERVICE_TOKEN is required in env for --direct mode"
  fi

  # D2: warmup without a token is refused before anything else
  log_step "D2" "POST $AI_URL/v1/warmup without a token (expect 401)"
  D2_CODE=$(curl -s -m 10 -o /dev/null -w '%{http_code}' -X POST "$AI_URL/v1/warmup")
  [ "$D2_CODE" = "401" ] || fail "D2" "Expected 401 without a token, got $D2_CODE"
  log_step "D2" "PASS (401)"

  # D3: warmup with the token
  log_step "D3" "POST $AI_URL/v1/warmup with the token (expect 200)"
  D3_CODE=$(curl -s -m 30 -o "$ERR_FILE" -w '%{http_code}' -X POST "$AI_URL/v1/warmup" \
    -H "Authorization: Bearer $AI_SERVICE_TOKEN")
  [ "$D3_CODE" = "200" ] || fail "D3" "Expected 200 with the token, got $D3_CODE (a 401 means the token differs from the service's)"
  log_step "D3" "PASS (status=$(jq -r '.status // empty' "$ERR_FILE"))"

  # D4: POST summary endpoint
  log_step "D4" "POST $AI_URL/v1/summaries/access-request-queue (Contract v1 sample)"
    INVOCATION_ID="3f0d7a3e-8b21-4c2f-9f10-2b7c4a1d5e60"
    BODY="{\"contractVersion\":\"1\",\"invocationId\":\"$INVOCATION_ID\",\"locale\":\"vi\",\"context\":{\"generatedAt\":\"2026-11-15T10:00:00Z\",\"requests\":[{\"sourceRef\":\"R001\",\"stepKind\":\"NEED_APPROVAL\",\"softwareName\":\"Figma Professional\",\"beneficiaryDisplayName\":\"Nguyen Van A\",\"reason\":\"Thiet ke ban giao dien\",\"requestedDurationLabel\":\"12 thang\",\"estimatedCostRef\":null}]}}"
    D4_CODE=$(curl -sS -m 20 -o "$ERR_FILE" -w '%{http_code}' -X POST "$AI_URL/v1/summaries/access-request-queue" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $AI_SERVICE_TOKEN" \
       -H "X-Request-Id: $INVOCATION_ID" \
       -d "$BODY")
    if [ "$D4_CODE" != "200" ]; then
      fail "D4" "Expected 200, got $D4_CODE error.code=$(jq -r '.error.code // empty' "$ERR_FILE" 2>/dev/null)"
    fi
    SUMMARY_RES=$(cat "$ERR_FILE")
 
     PARSE_STATUS=$(echo "$SUMMARY_RES" | jq -r '.parseStatus // empty')
     RESP_INVOCATION_ID=$(echo "$SUMMARY_RES" | jq -r '.invocationId // empty')
     ITEMS_COUNT=$(echo "$SUMMARY_RES" | jq -r '.parsed.items | length // 0')
     LATENCY_MS=$(echo "$SUMMARY_RES" | jq -r '.latencyMs // 0')
 
     if [ "$PARSE_STATUS" != "OK" ]; then
       fail "D4" "Expected parseStatus OK, got $PARSE_STATUS"
     fi
     if [ "$RESP_INVOCATION_ID" != "$INVOCATION_ID" ]; then
       fail "D4" "invocationId mismatch: $RESP_INVOCATION_ID != $INVOCATION_ID"
     fi
  if [ "$ITEMS_COUNT" -lt 1 ]; then
    fail "D4" "Expected at least 1 parsed item, got $ITEMS_COUNT"
  fi
  log_step "D4" "PASS (parseStatus=OK items=$ITEMS_COUNT latencyMs=${LATENCY_MS}ms)"

  log_step "DIRECT" "All direct smoke checks PASSED"
  exit 0
 fi
 
 # ==============================================================================
# FULL END-TO-END MODE: BE <-> AI-service
# ==============================================================================

if [ -z "$SUPER_ADMIN_EMAIL" ] || [ -z "$SUPER_ADMIN_PASSWORD" ]; then
  fail "AUTH" "SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be provided via environment"
fi
if [ -z "$MANAGER_EMAIL" ] || [ -z "$MANAGER_PASSWORD" ]; then
  fail "AUTH" "MANAGER_EMAIL and MANAGER_PASSWORD must be provided via environment"
fi

# S1: AI healthz
log_step "S1" "GET $AI_URL/healthz"
AI_HEALTH=$(curl -sS -f -m 30 "$AI_URL/healthz" 2>&1) || fail "S1" "Cannot reach AI service at $AI_URL/healthz"
AI_MODEL=$(echo "$AI_HEALTH" | jq -r '.modelId // empty')
AI_PROMPT_VER=$(echo "$AI_HEALTH" | jq -r '.promptVersion // empty')
assert_non_empty "$AI_MODEL" "modelId"
assert_non_empty "$AI_PROMPT_VER" "promptVersion"
log_step "S1" "PASS (modelId=$AI_MODEL promptVersion=$AI_PROMPT_VER)"

# S2: Login Super Admin
 log_step "S2" "POST $BE_URL/auth/login (Super Admin)"
 SA_LOGIN_RES=$(curl -sS -m 10 -X POST "$BE_URL/auth/login" \
   -H "Content-Type: application/json" \
   -d "{\"email\":\"$SUPER_ADMIN_EMAIL\",\"password\":\"$SUPER_ADMIN_PASSWORD\"}")
 SA_TOKEN=$(echo "$SA_LOGIN_RES" | jq -r '.data.accessToken // empty')
 assert_non_empty "$SA_TOKEN" "superAdmin.accessToken"
 log_step "S2" "PASS"
 
 # S3: Set AI_ENABLED to ON
 log_step "S3" "PUT $BE_URL/operating-parameters/AI_ENABLED -> ON"
 curl -sS -f -m 10 -X PUT "$BE_URL/operating-parameters/AI_ENABLED" \
   -H "Authorization: Bearer $SA_TOKEN" \
   -H "Content-Type: application/json" \
   -d '{"value":"ON"}' > /dev/null || fail "S3" "Failed to set AI_ENABLED parameter"
 log_step "S3" "PASS"
 
 # S4: Set AI_ACCESS_REQUEST_SUMMARY_ENABLED to ON
 log_step "S4" "PUT $BE_URL/operating-parameters/AI_ACCESS_REQUEST_SUMMARY_ENABLED -> ON"
 curl -sS -f -m 10 -X PUT "$BE_URL/operating-parameters/AI_ACCESS_REQUEST_SUMMARY_ENABLED" \
   -H "Authorization: Bearer $SA_TOKEN" \
   -H "Content-Type: application/json" \
   -d '{"value":"ON"}' > /dev/null || fail "S4" "Failed to set AI_ACCESS_REQUEST_SUMMARY_ENABLED parameter"
 log_step "S4" "PASS"
 
 # S5: Login Manager
 log_step "S5" "POST $BE_URL/auth/login (Manager: $MANAGER_EMAIL)"
 MGR_LOGIN_RES=$(curl -sS -m 10 -X POST "$BE_URL/auth/login" \
   -H "Content-Type: application/json" \
   -d "{\"email\":\"$MANAGER_EMAIL\",\"password\":\"$MANAGER_PASSWORD\"}")
 MGR_TOKEN=$(echo "$MGR_LOGIN_RES" | jq -r '.data.accessToken // empty')
 assert_non_empty "$MGR_TOKEN" "manager.accessToken"
 log_step "S5" "PASS"
 
 # S6: Get queue source
 log_step "S6" "GET $BE_URL/ai/access-request-summaries/source"
 SOURCE_RES=$(curl -sS -m 10 "$BE_URL/ai/access-request-summaries/source" \
   -H "Authorization: Bearer $MGR_TOKEN")
 QUEUE_REV=$(echo "$SOURCE_RES" | jq -r '.data.queueRevision // empty')
 STEP_COUNT=$(echo "$SOURCE_RES" | jq -r '.data.stepCount // empty')
 OMITTED_COUNT=$(echo "$SOURCE_RES" | jq -r '.data.omittedCount // 0')
assert_non_empty "$QUEUE_REV" "queueRevision"
assert_non_empty "$STEP_COUNT" "stepCount"
log_step "S6" "PASS (queueRevision=$QUEUE_REV stepCount=$STEP_COUNT omittedCount=$OMITTED_COUNT)"

if [ "$STEP_COUNT" -eq 0 ]; then
  printf 'INCONCLUSIVE: Manager approval queue is empty (stepCount=0). Run seed first.\n'
  exit 2
fi

# If EXPECT is AI.PROVIDER_UNAVAILABLE, check POST step returns 503
if [ "$EXPECT" = "AI.PROVIDER_UNAVAILABLE" ]; then
   log_step "S7-EXPECT" "POST $BE_URL/ai/access-request-summaries (expect 503 AI.PROVIDER_UNAVAILABLE)"
   HTTP_CODE=$(curl -s -m 10 -o "$ERR_FILE" -w "%{http_code}" -X POST "$BE_URL/ai/access-request-summaries" \
     -H "Authorization: Bearer $MGR_TOKEN" \
     -H "Content-Type: application/json" \
     -d "{\"queueRevision\":\"$QUEUE_REV\"}")
   if [ "$HTTP_CODE" != "503" ]; then
     fail "S7-EXPECT" "Expected HTTP 503, got $HTTP_CODE: $(cat "$ERR_FILE")"
   fi
   ERR_CODE=$(jq -r '.error.code // empty' "$ERR_FILE")
   if [ "$ERR_CODE" != "AI.PROVIDER_UNAVAILABLE" ]; then
     fail "S7-EXPECT" "Expected errorCode AI.PROVIDER_UNAVAILABLE, got $ERR_CODE"
   fi
   log_step "S7-EXPECT" "PASS (got 503 AI.PROVIDER_UNAVAILABLE as expected)"
   exit 0
 fi
 
 # S7: Create summary invocation
 log_step "S7" "POST $BE_URL/ai/access-request-summaries {queueRevision}"
 CREATE_RES=$(curl -sS -m 10 -X POST "$BE_URL/ai/access-request-summaries" \
   -H "Authorization: Bearer $MGR_TOKEN" \
   -H "Content-Type: application/json" \
   -d "{\"queueRevision\":\"$QUEUE_REV\"}")
 
 INVOCATION_ID=$(echo "$CREATE_RES" | jq -r '.data.invocationId // empty')
 INIT_STATUS=$(echo "$CREATE_RES" | jq -r '.data.status // empty')
 assert_non_empty "$INVOCATION_ID" "invocationId"
 log_step "S7" "PASS (invocationId=$INVOCATION_ID status=$INIT_STATUS)"
 
 # S8: Poll until COMPLETED or FAILED
 log_step "S8" "Polling GET $BE_URL/ai/access-request-summaries/$INVOCATION_ID"
 MAX_ATTEMPTS=75 # 75 * 2s = 150s
 ATTEMPT=0
 FINAL_STATUS=""
 
 while [ "$ATTEMPT" -lt "$MAX_ATTEMPTS" ]; do
   ATTEMPT=$((ATTEMPT + 1))
   GET_RES=$(curl -sS -m 10 "$BE_URL/ai/access-request-summaries/$INVOCATION_ID" \
     -H "Authorization: Bearer $MGR_TOKEN")
   CURRENT_STATUS=$(echo "$GET_RES" | jq -r '.data.status // empty')
 
   if [ "$CURRENT_STATUS" = "COMPLETED" ] || [ "$CURRENT_STATUS" = "FAILED" ] || [ "$CURRENT_STATUS" = "NO_VALID_OUTPUT" ]; then
     FINAL_STATUS="$CURRENT_STATUS"
     break
   fi
   sleep 2
 done
 
 if [ "$FINAL_STATUS" != "COMPLETED" ]; then
   ERR_CODE=$(echo "$GET_RES" | jq -r '.data.errorCode // empty')
   fail "S8" "Invocation failed to reach COMPLETED. Final status=$FINAL_STATUS errorCode=$ERR_CODE"
 fi

LINES_COUNT=$(echo "$GET_RES" | jq -r '.data.lines | length // 0')
ERROR_CODE=$(echo "$GET_RES" | jq -r '.data.errorCode // "null"')
SIMULATED=$(echo "$GET_RES" | jq -r '.data.simulated // "false"')

# stepCount is already the number of steps the summary covers (at most 20; omittedCount counts the steps past them).
# The stub writes one faithful line per step, so every step must come back as a checked line.
EXPECTED_LINES="$STEP_COUNT"
if [ "$LINES_COUNT" -ne "$EXPECTED_LINES" ]; then
  fail "S8" "Line count mismatch: got $LINES_COUNT, expected $EXPECTED_LINES (stepCount; omittedCount=$OMITTED_COUNT)"
fi
if [ "$LINES_COUNT" -le 0 ]; then
  fail "S8" "Expected lines > 0, got $LINES_COUNT"
fi
if [ "$ERROR_CODE" != "null" ]; then
  fail "S8" "Expected errorCode null, got $ERROR_CODE"
fi
if [ "$SIMULATED" != "false" ] && [ "$SIMULATED" != "null" ]; then
  fail "S8" "Expected simulated to be false or null, got $SIMULATED"
fi

log_step "S8" "PASS (status=COMPLETED lines=$LINES_COUNT errorCode=$ERROR_CODE simulated=$SIMULATED)"
 
 # S9: Super Admin inspect content
 log_step "S9" "GET $BE_URL/ai/invocations/$INVOCATION_ID/content (Super Admin)"
 # The worker stores the history after the call ends (outbox -> MongoDB): until then the route answers 409 AI.HISTORY_PENDING,
 # "try again shortly". Wait for it (up to OUTBOX_POLL_INTERVAL_MS and a delivery), never read 409 as a pass or a failure.
 # 90 s: one poll interval (OUTBOX_POLL_INTERVAL_MS, up to 60 s) and a first retry backoff of the delivery.
 for _ in $(seq 1 90); do
   CONTENT_HTTP=$(curl -sS -m 10 -o "$ERR_FILE" -w '%{http_code}' "$BE_URL/ai/invocations/$INVOCATION_ID/content" \
     -H "Authorization: Bearer $SA_TOKEN") || fail "S9" "Cannot reach $BE_URL (curl failed)"
   [ "$CONTENT_HTTP" = "409" ] && [ "$(jq -r '.error.code // empty' "$ERR_FILE")" = "AI.HISTORY_PENDING" ] || break
   sleep 1
 done
 [ "$CONTENT_HTTP" = "200" ] || fail "S9" "Expected HTTP 200, got $CONTENT_HTTP error.code=$(jq -r '.error.code // empty' "$ERR_FILE")"
 CONTENT_RES=$(cat "$ERR_FILE")
 PROMPT_TEXT=$(echo "$CONTENT_RES" | jq -r '.data.promptText // empty')
 RAW_RESP=$(echo "$CONTENT_RES" | jq -r '.data.rawResponse // empty')
 assert_non_empty "$PROMPT_TEXT" "content.promptText"
 assert_non_empty "$RAW_RESP" "content.rawResponse"
 log_step "S9" "PASS (content verified)"
 
 log_step "DONE" "Smoke verification SUCCESSFUL: invocation $INVOCATION_ID COMPLETED with $LINES_COUNT lines."
