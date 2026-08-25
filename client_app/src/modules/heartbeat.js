'use strict';

import os from 'node:os';
import { sleep, interruptibleSleep } from '../retry.js';

/**
 * Register + heartbeat loop, port of HeartbeatReporterService.cs.
 * Retries forever with backoff; re-registers automatically after a failure.
 */
export class HeartbeatReporterService {
  constructor(client, registry, options, logger, retryPolicy) {
    this.client = client;
    this.registry = registry;
    this.options = options;
    this.logger = logger;
    this.retryPolicy = retryPolicy;
    this.startedAt = Date.now();
    this.registered = false;
    this.running = false;
  }

  async register() {
    await this.client.register({
      clientId: this.options.clientId,
      clientName: this.options.clientName,
      machineName: os.hostname(),
      environment: this.options.environment,
      appVersion: this.options.appVersion ?? '1.0.0',
      os: `${os.type()} ${os.release()} (${os.arch()})`,
    });
    this.registered = true;
  }

  createHeartbeat() {
    return {
      timestamp: new Date().toISOString(),
      status: 'Online',
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      modules: this.registry.snapshot(),
    };
  }

  async run(abortSignal) {
    this.running = true;
    const intervalMs = Math.max(1, Number(this.options.heartbeatIntervalSeconds ?? 15)) * 1000;
    let consecutiveFailures = 0;

    while (this.running && !abortSignal?.aborted) {
      try {
        if (!this.registered) {
          await this.register();
          this.logger.info(`Registered with control server as ${this.options.clientId}.`);
        }
        await this.client.sendHeartbeat(this.createHeartbeat());
        consecutiveFailures = 0;
        await sleep(intervalMs);
      } catch (err) {
        this.registered = false;
        consecutiveFailures++;
        const delay = this.retryPolicy.getFailureDelay(consecutiveFailures);
        this.logger.warning(`Heartbeat failed (${consecutiveFailures}): ${err.message}; retry in ${(delay / 1000).toFixed(1)}s`);
        await interruptibleSleep(delay, abortSignal);
      }
    }
    this.running = false;
  }

  stop() {
    this.running = false;
  }
}
