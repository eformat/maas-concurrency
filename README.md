# maas-concurrency

see scripts for env vars.

```bash
k6 run bench.js \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e OPENAI_MODEL_NAME="$OPENAI_MODEL_NAME" \
  -e OPENAI_BASE_URL="$OPENAI_BASE_URL" \
  -e MAX_TOKENS="$MAX_TOKENS" \
  -e REQUESTS_PER_VU="$REQUESTS_PER_VU" \
  -e NO_KEEPALIVE="$NO_KEEPALIVE"
```

```bash
/bench.sh -k -c 50 -t100 -n 1
```
