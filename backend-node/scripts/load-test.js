// k6 load test for Clarifyd backend.
// Run: k6 run --vus 10 --duration 30s scripts/load-test.js
// Requires: COOKIE env (export COOKIE=authjs.session-token=...)

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE || 'http://localhost:3001';
const COOKIE = __ENV.COOKIE;

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const headers = COOKIE ? { Cookie: COOKIE } : {};

  const h = http.get(`${BASE}/api/health`);
  check(h, { 'health 200': (r) => r.status === 200 });

  const p = http.get(`${BASE}/api/security/posture`);
  check(p, { 'posture 200': (r) => r.status === 200 });

  if (COOKIE) {
    const l = http.get(`${BASE}/api/lawyers?jurisdiction=US`, { headers });
    check(l, { 'lawyers 200': (r) => r.status === 200 });
    const c = http.get(`${BASE}/api/user/context`, { headers });
    check(c, { 'context 200': (r) => r.status === 200 });
  }

  sleep(1);
}
