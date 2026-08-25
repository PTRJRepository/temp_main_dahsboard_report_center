'use strict';

/**
 * Internal module registry, port of ModuleRegistry.cs / ModuleState / ModuleStatus.
 * Status values match the .NET enum so the server UI shows familiar states:
 * NotStarted | Starting | Running | Stopping | Stopped | Failed | Crashed | Disabled
 */

export const ModuleStatus = {
  NotStarted: 'NotStarted',
  Starting: 'Starting',
  Running: 'Running',
  Stopping: 'Stopping',
  Stopped: 'Stopped',
  Failed: 'Failed',
  Crashed: 'Crashed',
  Disabled: 'Disabled',
};

export class ModuleRegistry {
  constructor() {
    /** @type {Map<string, {code: string, name: string, options: object, worker: object|null, status: string, restartCount: number, lastError: string|null}>} */
    this.modules = new Map();
  }

  register({ code, name, options, worker }) {
    const enabled = options?.enabled !== false;
    const autoStart = options?.autoStart !== false;
    this.modules.set(code.toUpperCase(), {
      code,
      name: name || code,
      options,
      worker,
      status: enabled ? (autoStart ? ModuleStatus.NotStarted : ModuleStatus.Stopped) : ModuleStatus.Disabled,
      restartCount: 0,
      lastError: null,
    });
  }

  all() {
    return [...this.modules.values()];
  }

  tryGetByCode(moduleCode) {
    if (!moduleCode) return null;
    return this.modules.get(String(moduleCode).toUpperCase()) ?? null;
  }

  async startOne(entry) {
    if (!entry) return false;
    if (entry.status === ModuleStatus.Running) return true;
    if (entry.status === ModuleStatus.Disabled) return false;
    try {
      entry.status = ModuleStatus.Starting;
      await entry.worker.start(entry.options);
      entry.status = ModuleStatus.Running;
      entry.lastError = null;
      return true;
    } catch (err) {
      entry.status = ModuleStatus.Failed;
      entry.lastError = err?.message ?? String(err);
      entry.restartCount += 1;
      return false;
    }
  }

  async stopOne(entry) {
    if (!entry) return;
    if (![ModuleStatus.Running, ModuleStatus.Starting, ModuleStatus.Failed].includes(entry.status)) return;
    try {
      entry.status = ModuleStatus.Stopping;
      await entry.worker.stop();
      entry.status = ModuleStatus.Stopped;
    } catch (err) {
      entry.status = ModuleStatus.Failed;
      entry.lastError = err?.message ?? String(err);
    }
  }

  snapshot() {
    return this.all().map(entry => ({
      moduleCode: entry.code,
      status: entry.status,
      pid: null,
      restartCount: entry.restartCount,
      lastError: entry.lastError,
    }));
  }
}
