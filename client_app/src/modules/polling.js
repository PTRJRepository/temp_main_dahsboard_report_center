'use strict';

import { interruptibleSleep } from '../retry.js';

/**
 * Command polling loop, port of CommandPollingService.cs.
 * Each received command is executed in a bounded in-flight pool (default 3)
 * so a slow command never blocks the poll loop; results are reported
 * best-effort so the server does not wait for its reaper.
 */
export class CommandPollingService {
  constructor(client, executor, options, logger, retryPolicy) {
    this.client = client;
    this.executor = executor;
    this.options = options;
    this.logger = logger;
    this.retryPolicy = retryPolicy;
    this.inflightLimit = Math.max(1, Number(options.inflightCommands ?? 3));
    this.running = false;
    this.active = new Set();
  }

  async run(abortSignal) {
    this.running = true;
    const intervalMs = Math.max(0.2, Number(this.options.commandPollIntervalSeconds ?? 5)) * 1000;
    let consecutiveFailures = 0;

    while (this.running && !abortSignal?.aborted) {
      try {
        const commands = await this.client.pollPendingCommands(this.options.maxCommandsPerPoll ?? 20);
        consecutiveFailures = 0;

        for (const command of commands) {
          while (this.active.size >= this.inflightLimit && this.running) {
            await Promise.race(this.active);
          }
          if (!this.running || abortSignal?.aborted) break;
          this.dispatch(command, abortSignal);
        }

        await interruptibleSleep(intervalMs, abortSignal);
      } catch (err) {
        consecutiveFailures++;
        const delay = this.retryPolicy.getFailureDelay(consecutiveFailures);
        if (consecutiveFailures === 1 || consecutiveFailures % 10 === 0) {
          this.logger.warning(`Command polling failed (${consecutiveFailures}): ${err.message}; retry in ${(delay / 1000).toFixed(1)}s`);
        }
        await interruptibleSleep(delay, abortSignal);
      }
    }
    this.running = false;
    await Promise.allSettled([...this.active]);
  }

  dispatch(command, abortSignal) {
    const task = (async () => {
      try {
        const result = await this.executor.execute(command);
        await this.client.reportCommandResult(command.commandId, {
          status: result.success ? 'Success' : 'Failed',
          message: result.message,
          executedAt: new Date().toISOString(),
        });
        this.logger.info(`Command ${command.commandType} ${command.commandId}: ${result.success ? 'Success' : 'Failed'} - ${result.message}`);
      } catch (err) {
        // best-effort failure report so the server doesn't wait for the reaper
        try {
          await this.client.reportCommandResult(command.commandId, {
            status: 'Failed',
            message: err?.message ?? String(err),
            executedAt: new Date().toISOString(),
          });
        } catch { /* ignore */ }
        this.logger.errorException(`Command ${command.commandType} ${command.commandId} threw.`, err);
      } finally {
        this.active.delete(task);
      }
    })();
    this.active.add(task);
  }

  stop() {
    this.running = false;
  }
}
