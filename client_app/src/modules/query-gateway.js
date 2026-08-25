'use strict';

import path from 'node:path';
import { validateReadOnlySql } from '../firebird/validator.js';
import { materializeParameters } from '../firebird/materializer.js';
import { executeFirebirdQuery } from '../firebird/executor.js';
import { QueryResultReporter } from '../reporting/reporter.js';
import { QueryResultOutbox } from '../reporting/outbox.js';
import { sleep } from '../retry.js';
import { sanitize as sanitizeLog } from '../logger.js';

export const QUERY_GATEWAY_MODULE = 'IFESS_QUERY_GATEWAY';
export const QUERY_GATEWAY_COMMAND = 'EXECUTE_FIREBIRD_QUERY';

// Batas dedupe job-id agar memori tidak tumbuh tanpa batas pada uptime panjang.
// (Paritas perilaku .NET yang memakai ConcurrentDictionary tanpa prune,
//  ditambah bound agar aman dijalankan berhari-hari.)
const MAX_TRACKED_JOB_IDS = 5000;

const DEFAULT_POLICY = {
  readOnlyOnly: true,
  allowOnlySelect: true,
  allowWithSelect: true,
  blockMultipleStatements: true,
  maxRows: 1000,
  timeoutSeconds: 30,
  maxConcurrentQueries: 3,
  maxQueueSize: 20,
  maxQueryLength: 10000,
  chunkSize: 500,
  maxParameters: 50,
  resultReportRetryCount: 3,
  resultReportRetryDelaySeconds: 2,
  resultOutboxEnabled: true,
  resultOutboxPath: path.join('data', 'query-gateway-outbox'),
  resultOutboxFlushIntervalSeconds: 10,
  resultOutboxFlushBatchSize: 50,
  resultOutboxMaxFiles: 1000,
};

/**
 * IFESS Query Gateway worker — port of QueryGatewayModule.cs.
 * Accepts EXECUTE_FIREBIRD_QUERY commands, re-materializes and re-validates
 * the SQL locally, runs it through isql.exe with a bounded worker pool, then
 * reports inline/chunked results with retry and a durable local outbox.
 */
export class QueryGatewayModule {
  constructor(baseDirectory, logger, controlClient, controlServerOptions) {
    this.baseDirectory = baseDirectory;
    this.logger = logger;
    this.client = controlClient;
    this.reporter = new QueryResultReporter(controlClient, controlServerOptions);
    this.policy = { ...DEFAULT_POLICY };
    /** @type {Set<string>} dedupe queryJobId */
    this.acceptedJobIds = new Set();
    /** @type {object[]} bounded queue */
    this.queue = [];
    this.running = false;
    this.workers = [];
    this.outboxFlusherRunning = false;
  }

  get code() { return QUERY_GATEWAY_MODULE; }

  async start(moduleOptions) {
    const custom = moduleOptions?.customConfig ?? {};
    this.policy = {
      ...DEFAULT_POLICY,
      ...(custom.queryPolicy ?? {}),
      database: {
        type: 'Firebird',
        path: '',
        username: '',
        password: '',
        useLocalhost: true,
        ...(custom.database ?? {}),
      },
    };
    this.outbox = new QueryResultOutbox(this.policy, this.baseDirectory);
    this.queue = [];
    this.queueWaiters = []; // resolver yang dibangunkan saat item masuk / stop
    this.acceptedJobIds.clear();
    this.running = true;

    const workerCount = Math.max(1, Number(this.policy.maxConcurrentQueries ?? 3));
    for (let i = 0; i < workerCount; i++) {
      this.workers.push(this.workerLoop());
    }
    this.outboxFlusherRunning = true;
    this.outboxFlushLoop();
    this.logger.info(`Query Gateway worker started. workers=${workerCount}, queue=${this.policy.maxQueueSize}, db=${sanitizeLog(this.policy.database.path)}`);
  }

  async stop() {
    this.running = false;
    this.outboxFlusherRunning = false;
    this.wakeAllWaiters(); // bangunkan worker agar loop keluar
    await Promise.allSettled(this.workers.splice(0));
  }

  canHandle(command) {
    return String(command?.commandType ?? '').toUpperCase() === QUERY_GATEWAY_COMMAND
      && String(command?.moduleCode ?? '').toUpperCase() === QUERY_GATEWAY_MODULE;
  }

  async handle(command) {
    if (!this.running) {
      return { success: false, message: 'IFESS_QUERY_GATEWAY is not running.' };
    }

    const payload = command.payload ?? {};
    if (!payload.queryJobId) {
      return { success: false, message: 'Invalid EXECUTE_FIREBIRD_QUERY payload.' };
    }
    if (this.acceptedJobIds.has(String(payload.queryJobId))) {
      return { success: true, message: 'Duplicate query job ignored.' };
    }
    if (this.queue.length >= Math.max(1, Number(this.policy.maxQueueSize))) {
      // Do not record the job id so a later redelivery can still run when the queue drains.
      await this.tryReportFailure(payload, 'Rejected', 'Query queue is full.');
      return { success: false, message: 'Query queue is full.' };
    }

    this.acceptedJobIds.add(String(payload.queryJobId));
    if (this.acceptedJobIds.size > MAX_TRACKED_JOB_IDS) {
      // Set iterasi berurutan sesuai insertion -> hapus entri paling tua.
      const oldest = this.acceptedJobIds.values().next().value;
      this.acceptedJobIds.delete(oldest);
    }

    const materialized = materializeParameters(
      payload.queryText ?? '',
      payload.parameters ?? [],
      Number(this.policy.maxParameters ?? 50),
    );
    if (!materialized.success) {
      const message = materialized.errors.join(' ');
      await this.tryReportFailure(payload, 'Rejected', message);
      return { success: false, message };
    }

    payload.queryText = materialized.queryText;
    const validation = validateReadOnlySql(payload.queryText, Number(this.policy.maxQueryLength ?? 10000));
    if (!validation.valid) {
      const message = validation.errors.join(' ');
      await this.tryReportFailure(payload, 'Rejected', message);
      return { success: false, message };
    }

    applyPolicyLimits(payload, this.policy);
    this.queue.push(payload);
    this.wakeOneWaiter();
    return { success: true, message: 'Query job queued.' };
  }

  wakeOneWaiter() {
    const resolve = this.queueWaiters.shift();
    if (resolve) resolve();
  }

  async workerLoop() {
    while (true) {
      if (this.queue.length === 0) {
        // Event-driven: tidur sampai ada item baru atau stop() dipanggil.
        if (!this.running) return;
        await this.waitForNotification();
        continue;
      }
      const payload = this.queue.shift();

      const startedAtIso = new Date().toISOString();
      try {
        const result = await executeFirebirdQuery(
          payload,
          { database: this.policy.database },
          Math.max(1, Number(payload.timeoutSeconds)) * 1000,
        );
        if (!result.headers || result.headers.length === 0) {
          await this.tryReportFailure(
            payload,
            'Failed',
            'Query execution returned no column metadata from Firebird/isql. Check the client version, isql output, database path, and Firebird permissions.',
          );
          continue;
        }
        const finishedAtIso = new Date().toISOString();
        await this.tryReportWithRetry(this.reporter.createSuccessEnvelopes(payload, result, startedAtIso, finishedAtIso));
      } catch (err) {
        if (err?.isTimeout || /timed out/i.test(err?.message ?? '')) {
          await this.tryReportFailure(payload, 'Timeout', 'Query timed out.');
        } else {
          await this.tryReportFailure(payload, 'Failed', sanitizeLog(err?.message ?? 'Query execution failed.'));
        }
      }
    }
  }

  waitForNotification() {
    return new Promise(resolve => {
      this.queueWaiters.push(resolve);
    });
  }

  wakeAllWaiters() {
    const waiters = this.queueWaiters.splice(0);
    for (const resolve of waiters) resolve();
  }

  async tryReportFailure(payload, status, message) {
    await this.tryReportWithRetry([this.reporter.createFailureEnvelope(payload, status, message)]);
  }

  async tryReportWithRetry(envelopes) {
    const attempts = Math.max(1, Number(this.policy.resultReportRetryCount ?? 3) + 1);
    const delayMs = Math.max(1, Number(this.policy.resultReportRetryDelaySeconds ?? 2)) * 1000;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.reporter.send(envelopes);
        return;
      } catch {
        if (attempt >= attempts) {
          try { await this.outbox.save(envelopes); } catch { /* ignore */ }
          return;
        }
        await sleep(delayMs);
      }
    }
  }

  async outboxFlushLoop() {
    while (this.outboxFlusherRunning) {
      try {
        await this.flushOutboxOnce();
      } catch { /* keep looping */ }
      await sleep(Math.max(1, Number(this.policy.resultOutboxFlushIntervalSeconds ?? 10)) * 1000);
    }
  }

  async flushOutboxOnce() {
    if (!this.outbox) return;
    const items = await this.outbox.loadBatch(Number(this.policy.resultOutboxFlushBatchSize ?? 50));
    for (const item of items) {
      try {
        await this.reporter.send([item.envelope]);
        await this.outbox.remove(item.filePath);
      } catch {
        return; // server still down; retry on next cycle
      }
    }
  }
}

function applyPolicyLimits(payload, policy) {
  payload.maxRows = clamp(payload.maxRows, 1, Math.max(1, policy.maxRows));
  payload.timeoutSeconds = clamp(payload.timeoutSeconds, 1, Math.max(1, policy.timeoutSeconds));
  payload.chunkSize = clamp(payload.chunkSize, 1, Math.max(1, policy.chunkSize));
  payload.readOnly = true;
}

function clamp(value, min, max) {
  return Math.min(Math.max(1, Number(value) || min), max);
}
