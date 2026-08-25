'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';
import { RetryPolicy } from '../src/retry.js';

test('backoff grows exponentially', () => {
  const policy = new RetryPolicy({ baseDelaySeconds: 2, maxDelaySeconds: 60, jitterRatio: 0 });
  const samples = [1, 2, 3, 4, 5, 6].map(n => policy.getFailureDelay(n));
  assert.deepEqual(samples, [2000, 4000, 8000, 16000, 32000, 60000]);
});

test('delay is capped at maxDelaySeconds', () => {
  const policy = new RetryPolicy({ baseDelaySeconds: 2, maxDelaySeconds: 10, jitterRatio: 0 });
  assert.equal(policy.getFailureDelay(50), 10000);
});

test('jitter stays within +/- ratio', () => {
  const policy = new RetryPolicy({ baseDelaySeconds: 4, maxDelaySeconds: 100, jitterRatio: 0.25 });
  for (let i = 0; i < 200; i++) {
    const delay = policy.getFailureDelay(1);
    assert.ok(delay >= 3000 && delay <= 5000, `delay ${delay} out of range`);
  }
});
