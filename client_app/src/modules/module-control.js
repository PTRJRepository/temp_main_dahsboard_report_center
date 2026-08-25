'use strict';

import os from 'node:os';
import { ModuleStatus } from './registry.js';

const SUPPORTED_MODULE_COMMANDS = new Set([
  'PING',
  'START_MODULE',
  'STOP_MODULE',
  'RESTART_MODULE',
  'START_ALL_MODULES',
  'STOP_ALL_MODULES',
]);

/**
 * Handles module lifecycle commands (PING / START_MODULE / ...), port of
 * ModuleControlCommandHandler.cs. EXECUTE_GDRIVE_BACKUP is answered with a
 * clear failure because this Node client does not ship Google Drive backup.
 */
export class ModuleControlHandler {
  constructor(registry) {
    this.registry = registry;
  }

  canHandle(command) {
    const type = String(command?.commandType ?? '').toUpperCase();
    if (SUPPORTED_MODULE_COMMANDS.has(type)) return true;
    if (type === 'EXECUTE_GDRIVE_BACKUP') return true; // handled as explicit failure below
    return false;
  }

  async handle(command) {
    const type = String(command.commandType ?? '').toUpperCase();
    switch (type) {
      case 'PING':
        return ok(`pong from ${os.hostname()} at ${new Date().toISOString()}`);
      case 'START_MODULE':
        return this.startOne(command.moduleCode);
      case 'STOP_MODULE':
        return this.stopOne(command.moduleCode);
      case 'RESTART_MODULE':
        return this.restartOne(command.moduleCode);
      case 'START_ALL_MODULES':
        return this.startAll();
      case 'STOP_ALL_MODULES':
        return this.stopAll();
      case 'EXECUTE_GDRIVE_BACKUP':
        return failed('EXECUTE_GDRIVE_BACKUP is not supported by this client build (Google Drive backup not included).');
      default:
        return failed(`Unsupported command '${command.commandType}'.`);
    }
  }

  async startOne(moduleCode) {
    const entry = requireEntry(this.registry, moduleCode);
    if (!entry.ok) return failed(entry.error);
    if (entry.module.status === ModuleStatus.Running) {
      return ok(`Module '${entry.module.code}' is already running.`);
    }
    if (entry.module.status === ModuleStatus.Disabled) {
      return failed(`Module '${entry.module.code}' is disabled.`);
    }
    const started = await this.registry.startOne(entry.module);
    return started
      ? ok(`Module '${entry.module.code}' started.`)
      : failed(`Module '${entry.module.code}' failed to start. ${entry.module.lastError ?? ''}`.trim());
  }

  async stopOne(moduleCode) {
    const entry = requireEntry(this.registry, moduleCode);
    if (!entry.ok) return failed(entry.error);
    const status = entry.module.status;
    if (status === ModuleStatus.Stopped || status === ModuleStatus.NotStarted) {
      return ok(`Module '${entry.module.code}' is not running.`);
    }
    if (status === ModuleStatus.Disabled) {
      return ok(`Module '${entry.module.code}' is disabled.`);
    }
    await this.registry.stopOne(entry.module);
    return ok(`Module '${entry.module.code}' stopped.`);
  }

  async restartOne(moduleCode) {
    const entry = requireEntry(this.registry, moduleCode);
    if (!entry.ok) return failed(entry.error);
    if (entry.module.status === ModuleStatus.Disabled) {
      return failed(`Module '${entry.module.code}' is disabled.`);
    }
    const status = entry.module.status;
    if ([ModuleStatus.Running, ModuleStatus.Starting, ModuleStatus.Stopping, ModuleStatus.Failed].includes(status)) {
      await this.registry.stopOne(entry.module);
    }
    const started = await this.registry.startOne(entry.module);
    return started
      ? ok(`Module '${entry.module.code}' restarted.`)
      : failed(`Module '${entry.module.code}' failed to restart. ${entry.module.lastError ?? ''}`.trim());
  }

  async startAll() {
    let count = 0;
    for (const entry of this.registry.all()) {
      if ((entry.options?.enabled !== false)
        && entry.status !== ModuleStatus.Running
        && entry.status !== ModuleStatus.Disabled) {
        if (await this.registry.startOne(entry)) count++;
      }
    }
    return ok(`Started ${count} module(s).`);
  }

  async stopAll() {
    let count = 0;
    for (const entry of this.registry.all()) {
      if ([ModuleStatus.Running, ModuleStatus.Starting, ModuleStatus.Stopping].includes(entry.status)) {
        await this.registry.stopOne(entry);
        count++;
      }
    }
    return ok(`Stopped ${count} module(s).`);
  }
}

export { ModuleStatus };

function requireEntry(registry, moduleCode) {
  if (!moduleCode) return { ok: false, error: 'moduleCode is required.' };
  const module = registry.tryGetByCode(moduleCode);
  if (!module) return { ok: false, error: `Module '${moduleCode}' is not registered.` };
  return { ok: true, module };
}

function ok(message) { return { success: true, message }; }
function failed(message) { return { success: false, message }; }
