import http from 'k6/http';
import { check } from 'k6';

const API_KEY    = __ENV.OPENAI_API_KEY;
const MODEL_NAME = __ENV.OPENAI_MODEL_NAME;
const BASE_URL   = __ENV.OPENAI_BASE_URL;

if (!API_KEY)    throw new Error('Set OPENAI_API_KEY via -e');
if (!MODEL_NAME) throw new Error('Set OPENAI_MODEL_NAME via -e');
if (!BASE_URL)   throw new Error('Set OPENAI_BASE_URL via -e');

const CONCURRENCY     = __ENV.CONCURRENCY     || '1,8,16,32,64,128';
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

export function setup() {
  console.log('=== MaaS Concurrency Bench (k6) ===');
  console.log(`URL:             ${url}`);
  console.log(`Model:           ${MODEL_NAME}`);
  console.log(`Max tokens:      ${MAX_TOKENS}`);
  console.log(`Levels:          ${levels.join(', ')}`);
  console.log(`Iterations/VU:   ${REQUESTS_PER_VU}`);
  console.log(`Insecure TLS:    ${INSECURE}`);
  console.log(`Connection reuse: ${!NO_KEEPALIVE}`);
}

export function bench() {
  const prompt = prompts[Math.floor(Math.random() * prompts.length)];
  const payload = JSON.stringify({
    model: MODEL_NAME,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: MAX_TOKENS,
  });

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
