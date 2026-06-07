#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 [-c concurrency_levels] [-n total_requests] [-t max_tokens]"
  echo "  -c  Comma-separated concurrency levels (default: 1,8,16)"
  echo "  -n  Requests per concurrent slot (total = n * c, default: 1)"
  echo "  -t  Max tokens in response (default: 8)"
  echo "  -k  Allow insecure TLS (self-signed certs)"
  echo ""
  echo "Example: $0 -c 1,4,8,16,32 -n 64 -t 20"
  exit 1
}

CONCURRENCY="1,8,16,32,64,128"
TOTAL_REQUESTS=""
MAX_TOKENS=20
CURL_EXTRA=""

while getopts "c:n:t:kh" opt; do
  case $opt in
    c) CONCURRENCY="$OPTARG" ;;
    n) TOTAL_REQUESTS="$OPTARG" ;;
    t) MAX_TOKENS="$OPTARG" ;;
    k) CURL_EXTRA="-k" ;;
    h) usage ;;
    *) usage ;;
  esac
done

OPENAI_API_KEY="${OPENAI_API_KEY:?Set OPENAI_API_KEY}"
OPENAI_MODEL_NAME="${OPENAI_MODEL_NAME:?Set OPENAI_MODEL_NAME}"
OPENAI_BASE_URL="${OPENAI_BASE_URL:?Set OPENAI_BASE_URL}"

URL="${OPENAI_BASE_URL}/chat/completions"
PAYLOAD=$(mktemp /tmp/bench-payload.XXXXXX)
RESULTS=$(mktemp /tmp/bench-results.XXXXXX)

cat > "$PAYLOAD" <<EOF
{"model":"${OPENAI_MODEL_NAME}","messages":[{"role":"user","content":"Say hello in one word."}],"max_tokens":${MAX_TOKENS}}
EOF

cleanup() { rm -f "$PAYLOAD" "$RESULTS"; }
trap cleanup EXIT

run_level() {
  local n=$1 c=$2
  local tmpdir
  tmpdir=$(mktemp -d /tmp/bench-results.XXXXXX)
  > "$RESULTS"
  local start end elapsed
  start=$(date +%s%N)
  seq "$n" | xargs -P "$c" -I{} \
    sh -c "curl -s -o /dev/null --max-time 120 $CURL_EXTRA -w '%{http_code} %{time_total}\n' \
      -X POST \
      -H 'Content-Type: application/json' \
      -H 'Authorization: Bearer ${OPENAI_API_KEY}' \
      -d @'$PAYLOAD' \
      '$URL' > '$tmpdir/{}.txt' 2>/dev/null"
  cat "$tmpdir"/*.txt > "$RESULTS" 2>/dev/null
  rm -rf "$tmpdir"
  end=$(date +%s%N)
  elapsed=$(awk "BEGIN {printf \"%.3f\", ($end - $start) / 1000000000}")

  local complete failed
  complete=$(wc -l < "$RESULTS")
  failed=$(awk '$1 < 200 || $1 >= 400 {n++} END {print n+0}' "$RESULTS")

  local mean_ms rps
  mean_ms=$(awk '{sum += $2} END {printf "%.3f", (sum / NR) * 1000}' "$RESULTS")
  rps=$(awk "BEGIN {printf \"%.2f\", $complete / $elapsed}")

  local status_summary
  status_summary=$(awk '{print $1}' "$RESULTS" | sort | uniq -c | sort -rn | \
    awk '{printf "%s:%s  ", $2, $1} END {print ""}')

  printf "Concurrency Level:      %s\n" "$c"
  printf "Time taken for tests:   %s seconds\n" "$elapsed"
  printf "Complete requests:      %s\n" "$complete"
  printf "Failed requests:        %s\n" "$failed"
  printf "Status codes:           %s\n" "$status_summary"
  printf "Requests per second:    %s [#/sec] (mean)\n" "$rps"
  printf "Time per request:       %s [ms] (mean)\n" "$mean_ms"
}

IFS=',' read -ra LEVELS <<< "$CONCURRENCY"
MULTI=${TOTAL_REQUESTS:-1}

echo "=== MaaS Concurrency Bench ==="
echo "URL:        $URL"
echo "Model:      $OPENAI_MODEL_NAME"
echo "Max tokens: $MAX_TOKENS"
echo "Levels:     ${LEVELS[*]}"
echo "Multiplier: x$MULTI per slot"
echo ""

for C in "${LEVELS[@]}"; do
  N=$((C * MULTI))

  echo "--- concurrency=$C  requests=$N ---"
  run_level "$N" "$C"
  echo ""
done
