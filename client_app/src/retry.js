'use strict';

/**
 * Exponential backoff + jitter, port of ControlServerRetryPolicy.
 * delay(n) = min(maxDelay, base * 2^(n-1)) with +/- jitterRatio randomization
 * so many clients do not reconnect in the same instant after a server restart.
 */
export class RetryPolicy {
  constructor({ baseDelaySeconds = 2, maxDelaySeconds = 60, jitterRatio = 0.2 } = {}) {
    this.baseMs = Math.max(0.2, Number(baseDelaySeconds)) * 1000;
    this.maxMs = Math.max(this.baseMs, Number(maxDelaySeconds) * 1000);
    this.jitterRatio = Math.min(1, Math.max(0, Number(jitterRatio)));
  }

  getFailureDelay(consecutiveFailures) {
    const exponent = Math.max(1, consecutiveFailures) - 1;
    const raw = this.baseMs * 2 ** exponent;
    return applyJitter(Math.min(this.maxMs, raw), this.jitterRatio);
  }
}

export function applyJitter(ms, ratio) {
  if (!ratio) return ms;
  const spread = ms * ratio;
  return ms + (Math.random() * 2 - 1) * spread;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

/** sleep() yang langsung selesai ketika abortSignal ter-trigger. */
export function interruptibleSleep(ms, abortSignal) {
  return new Promise(resolve => {
    if (abortSignal?.aborted) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      abortSignal?.removeEventListener('abort', finish);
      resolve();
    }
    abortSignal?.addEventListener('abort', finish, { once: true });
  });
}
