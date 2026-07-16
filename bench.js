import http from 'k6/http';
import { check, sleep } from 'k6';

const API_KEY    = __ENV.OPENAI_API_KEY;
const MODEL_NAME = __ENV.OPENAI_MODEL_NAME;
const BASE_URL   = __ENV.OPENAI_BASE_URL;

if (!API_KEY)    throw new Error('Set OPENAI_API_KEY via -e');
if (!MODEL_NAME) throw new Error('Set OPENAI_MODEL_NAME via -e');
if (!BASE_URL)   throw new Error('Set OPENAI_BASE_URL via -e');

const CONCURRENCY     = __ENV.CONCURRENCY     || '1,8,16,32,64,128,256,512';
const REQUESTS_PER_VU = parseInt(__ENV.REQUESTS_PER_VU || '1', 10);
const MAX_TOKENS      = parseInt(__ENV.MAX_TOKENS      || '20', 10);
const INSECURE        = (__ENV.INSECURE     || 'false') === 'true';
const NO_KEEPALIVE    = (__ENV.NO_KEEPALIVE || 'false') === 'true';

const levels = CONCURRENCY.split(',').map(s => parseInt(s.trim(), 10));

const scenarios = {};
levels.forEach(c => {
  scenarios[`c_${c}`] = {
    executor: 'per-vu-iterations',
    vus: c,
    iterations: REQUESTS_PER_VU,
    maxDuration: '10m',
    gracefulStop: '120s',
    exec: 'bench',
    tags: { concurrency: String(c) },
  };
});

export const options = {
  scenarios,
  insecureSkipTLSVerify: INSECURE,
  noConnectionReuse: NO_KEEPALIVE,
};

const url = `${BASE_URL}/chat/completions`;

const prompts = [
  'Say hello in one word.',
  'Name a color.',
  'What is 2+2?',
  'Name a planet.',
  'Say goodbye in one word.',
  'Name a fruit.',
  'What day comes after Monday?',
  'Name an animal.',
];

const params = {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  },
  timeout: '120s',
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

export function setup() {
  console.log('=== MaaS Concurrency Bench (k6) ===');
  console.log(`URL:             ${url}`);
  console.log(`Model:           ${MODEL_NAME}`);
  console.log(`Max tokens:      ${MAX_TOKENS}`);
  console.log(`Levels:          ${levels.join(', ')}`);
  console.log(`Iterations/VU:   ${REQUESTS_PER_VU}`);
  console.log(`Insecure TLS:    ${INSECURE}`);
  console.log(`Connection reuse: ${!NO_KEEPALIVE}`);
  console.log(`Max retries:      ${MAX_RETRIES}`);
  console.log(`Retry delay:      ${RETRY_DELAY_MS}ms`);
}

export function bench() {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  const payload = JSON.stringify({
    model: MODEL_NAME,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: MAX_TOKENS,
  });

  let res;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    res = http.post(url, payload, params);
    if (res.status === 200 || (res.status > 0 && res.status < 500)) break;
    if (attempt < MAX_RETRIES - 1) sleep(RETRY_DELAY_MS / 1000);
  }

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
