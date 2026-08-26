#!/usr/bin/env node
'use strict';

/**
 * IFESS Client App — sisi client untuk IFESS Control Server
 * (D:\Gawean Rebinmas\Kerani_Super_App\IFESS.ControlServer\js-server).
 *
 * Port Node.js dari IFESS.SuperApp (.NET):
 *   - register + heartbeat dengan retry/backoff+jitter
 *   - polling command (PING, START/STOP/RESTART_MODULE, EXECUTE_AUTO_TASK_KILL,
 *     EXECUTE_FIREBIRD_QUERY, EXECUTE_SHOW_NOTIFICATION) dengan bounded concurrency
 *   - push notification satu arah: Windows Toast korporat tanpa UI tambahan
 *   - Firebird Query Gateway via isql.exe: validasi read-only ulang di client,
 *     materialisasi parameter, result inline/chunked, durable outbox
 *
 * Jalankan:  npm start  atau  node src/index.js --config client.config.json
 */

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.js';
import { Logger, cleanupOldLogs, registerRedaction } from './logger.js';
import { RetryPolicy } from './retry.js';
import { ControlServerClient } from './control-client.js';
import { ModuleRegistry } from './modules/registry.js';
import { AutoTaskKillModule } from './modules/auto-task-kill.js';
import { QueryGatewayModule } from './modules/query-gateway.js';
import { PushNotificationModule } from './modules/push-notification.js';
import { ModuleControlHandler } from './modules/module-control.js';
import { CommandExecutor } from './modules/command-executor.js';
import { HeartbeatReporterService } from './modules/heartbeat.js';
import { CommandPollingService } from './modules/polling.js';

const baseDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { config: path.join(baseDirectory, 'client.config.json') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config' && argv[i + 1]) {
      args.config = path.resolve(argv[i + 1]);
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig({ configPath: args.config });

  const logger = new Logger(path.resolve(baseDirectory, config.logging.rootPath ?? 'logs'), config.logging);
  registerRedaction(config.controlServer?.apiKey);
  cleanupOldLogs(logger.rootPath, config.logging.retainDays);

  console.log('==========================================================');
  console.log(` ${config.app?.name ?? 'IFESS Client App'} v1.0.0`);
  console.log(` base      : ${baseDirectory}`);
  console.log(` config    : ${args.config}`);
  console.log(` clientId  : ${config.controlServer.clientId}`);
  console.log(` server    : ${config.controlServer.baseUrl}`);
  console.log('==========================================================');
  logger.info('Host starting.');

  const registry = new ModuleRegistry();
  const controlClient = new ControlServerClient(config.controlServer);

  // ── Build internal workers dari konfigurasi modules[] ────────────────────
  for (const rawOptions of config.modules ?? []) {
    // Terima nama kunci gaya appsettings.json (Code/Name/Enabled/AutoStart/
    // CustomConfig) maupun camelCase.
    const moduleOptions = {
      code: rawOptions.code ?? rawOptions.Code,
      name: rawOptions.name ?? rawOptions.Name,
      enabled: rawOptions.enabled ?? rawOptions.Enabled,
      autoStart: rawOptions.autoStart ?? rawOptions.AutoStart,
      customConfig: rawOptions.customConfig ?? rawOptions.CustomConfig,
    };
    const code = String(moduleOptions.code ?? '').toUpperCase();
    let worker = null;
    if (code === 'IFESS_AUTO_TASK_KILL') {
      worker = new AutoTaskKillModule(baseDirectory, logger.forModule(code));
    } else if (code === 'IFESS_QUERY_GATEWAY') {
      worker = new QueryGatewayModule(baseDirectory, logger.forModule(code), controlClient, config.controlServer);
    } else if (code === 'IFESS_PUSH_NOTIFICATION') {
      worker = new PushNotificationModule(baseDirectory, logger.forModule(code));
    } else {
      logger.warning(`Unknown module '${moduleOptions.code}' in config skipped.`);
      continue;
    }
    registry.register({
      code,
      name: moduleOptions.name,
      options: { enabled: moduleOptions.enabled, autoStart: moduleOptions.autoStart, customConfig: moduleOptions.customConfig },
      worker,
    });
  }

  // Register DB password(s) for log redaction.
  for (const entry of registry.all()) {
    const dbPassword = entry.options?.customConfig?.database?.password;
    if (dbPassword) registerRedaction(dbPassword);
  }

  // ── Start AutoStart modules ───────────────────────────────────────────────
  for (const entry of registry.all()) {
    if ((entry.options?.enabled !== false) && (entry.options?.autoStart !== false)
      && entry.status !== 'Disabled' && entry.status !== 'Stopped') {
      const started = await registry.startOne(entry);
      if (!started) logger.errorException(`Module ${entry.code} failed to start.`, new Error(entry.lastError ?? 'unknown'));
    }
  }

  // ── Control server loops ──────────────────────────────────────────────────
  const abortController = new AbortController();
  const backgroundTasks = [];

  if (config.controlServer.enabled) {
    const retryPolicy = new RetryPolicy(config.controlServer.retry);
    const heartbeat = new HeartbeatReporterService(controlClient, registry, config.controlServer, logger, retryPolicy);
    const executor = new CommandExecutor([
      new ModuleControlHandler(registry),
      ...registry.all().filter(entry => entry.worker).map(entry => entry.worker),
    ]);
    const polling = new CommandPollingService(controlClient, executor, config.controlServer, logger, retryPolicy);

    try {
      await heartbeat.register();
      logger.info(`Registered with control server as ${config.controlServer.clientId}.`);
    } catch (err) {
      logger.warning(`Control Server registration failed; will keep retrying in background. ${err.message}`);
    }

    backgroundTasks.push(heartbeat.run(abortController.signal));
    backgroundTasks.push(polling.run(abortController.signal));

    shutdownHooks(() => {
      heartbeat.stop();
      polling.stop();
      abortController.abort();
    });
  } else {
    logger.warning('controlServer.enabled=false - running offline (workers only).');
  }

  // Satu hook shutdown terpadu (SIGINT/SIGTERM/SIGHUP/SIGBREAK).
  shutdownHooks(() => {
    shutdownRequested = true;
    abortController.abort();
  });

  await Promise.allSettled(backgroundTasks);
  await stopModules(registry, logger);
  logger.info('Host stopped.');
}

async function stopModules(registry, logger) {
  for (const entry of registry.all()) {
    try {
      await registry.stopOne(entry);
    } catch (err) {
      logger.errorException(`Failed stopping module ${entry.code}.`, err);
    }
  }
}

function shutdownHooks(hook) {
  let called = false;
  const runOnce = () => {
    if (called) return;
    called = true;
    hook();
  };
  process.on('SIGINT', runOnce);
  process.on('SIGTERM', runOnce);
  // Ctrl+C di Windows (Git Bash / konsol) memicu SIGHUP/SIGBREAK pada beberapa shell.
  process.on('SIGHUP', runOnce);
  process.on('SIGBREAK', runOnce);
}

main().catch(err => {
  console.error('Fatal startup error:', err);
  process.exitCode = 1;
});
