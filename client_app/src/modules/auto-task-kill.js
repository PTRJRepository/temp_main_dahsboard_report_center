'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { sleep } from '../retry.js';
import { sanitize as sanitizeLog } from '../logger.js';

export const AUTO_TASK_KILL_MODULE = 'IFESS_AUTO_TASK_KILL';
export const AUTO_TASK_KILL_COMMAND = 'EXECUTE_AUTO_TASK_KILL';

const DEFAULT_OPTIONS = {
  defaultTargets: [],
  matchMode: 'Contains',
  allowContainsMatch: true,
  killEntireProcessTree: true,
  stopTimeoutSeconds: 5,
  scheduleCheckIntervalSeconds: 5,
  protectedProcessNames: [
    'System', 'Idle', 'Registry', 'smss', 'csrss', 'wininit', 'winlogon',
    'services', 'lsass', 'svchost', 'explorer', 'dwm', 'node',
  ],
  schedules: [],
};

/**
 * Auto Task Kill module — port of AutoTaskKillModule.cs.
 * Handles EXECUTE_AUTO_TASK_KILL (KillNow / Schedule / RemoveSchedule) and a
 * scheduler worker that fires saved Once/Daily schedules. Windows only:
 * process enumeration via tasklist, termination via taskkill /T /F.
 */
export class AutoTaskKillModule {
  constructor(baseDirectory, logger) {
    this.baseDirectory = baseDirectory;
    this.logger = logger;
    this.scheduleStorePath = path.join(baseDirectory, 'data', 'auto-task-kill-schedules.json');
    this.options = { ...DEFAULT_OPTIONS };
    /** @type {object[]} */
    this.schedules = [];
    /** @type {Map<string, number>} commandId -> seenAt epoch ms */
    this.seenCommands = new Map();
    this.running = false;
  }

  get code() { return AUTO_TASK_KILL_MODULE; }

  async start(moduleOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...(moduleOptions?.customConfig ?? {}) };
    this.schedules = [];
    for (const schedule of this.options.schedules ?? []) {
      this.schedules.push({ ...schedule });
    }
    this.loadSavedSchedules();
    this.running = true;
    this.schedulerLoop();
    this.logger.info(`Auto Task Kill worker started. Targets: ${this.getConfiguredTargets().join(', ')}`);
  }

  async stop() {
    this.running = false;
    this.logger.info('Auto Task Kill worker stopped.');
  }

  canHandle(command) {
    return String(command?.commandType ?? '').toUpperCase() === AUTO_TASK_KILL_COMMAND
      && String(command?.moduleCode ?? '').toUpperCase() === AUTO_TASK_KILL_MODULE;
  }

  async handle(command) {
    if (!this.running) {
      return failed('IFESS_AUTO_TASK_KILL is not running.');
    }
    // Idempotency: skip re-delivered commands (server re-queue / network blip).
    if (this.seenCommands.has(command.commandId)) {
      return ok('duplicate command, skipped');
    }
    this.seenCommands.set(command.commandId, Date.now());
    pruneSeenCommands(this.seenCommands);

    const payload = command.payload ?? {};
    const action = String(payload.action ?? 'KillNow').trim();

    if (action.toLowerCase() === 'schedule') {
      let schedule;
      try {
        schedule = this.createSchedule(payload);
      } catch (err) {
        return failed(err.message);
      }
      const index = this.schedules.findIndex(item => item.scheduleId === schedule.scheduleId);
      if (index >= 0) this.schedules.splice(index, 1);
      this.schedules.push(schedule);
      this.saveSchedules();
      return ok(`Auto Task Kill schedule saved: ${schedule.scheduleId} targets=${schedule.processNames.join(', ')}.`);
    }

    if (action.toLowerCase() === 'removeschedule') {
      if (!payload.scheduleId) return failed('scheduleId is required for RemoveSchedule.');
      const before = this.schedules.length;
      this.schedules = this.schedules.filter(item => item.scheduleId !== payload.scheduleId);
      this.saveSchedules();
      return ok(`Removed ${before - this.schedules.length} Auto Task Kill schedule(s).`);
    }

    const result = await this.killTargets(this.getTargets(payload), payload.matchMode, payload.reason ?? 'command');
    return ok(`Auto Task Kill completed. matched=${result.matchedCount}, killed=${result.killedCount}, skipped=${result.skippedCount}. ${result.messages.join(' ')}`);
  }

  // ── Scheduling ────────────────────────────────────────────────────────────

  schedulerLoop() {
    void (async () => {
      while (this.running) {
        try {
          const due = this.schedules.filter(schedule => isDue(schedule, new Date()));
          for (const schedule of due) {
            const result = await this.killTargets(schedule.processNames, schedule.matchMode, schedule.reason ?? 'scheduled');
            this.logger.info(`Scheduled Auto Task Kill ${schedule.scheduleId}: matched=${result.matchedCount}, killed=${result.killedCount}, skipped=${result.skippedCount}.`);
            markTriggered(this.schedules, schedule.scheduleId);
            this.saveSchedules();
          }
        } catch (err) {
          this.logger.errorException('Auto Task Kill scheduler failed.', err);
        }
        await sleep(Math.max(1, Number(this.options.scheduleCheckIntervalSeconds ?? 5)) * 1000);
      }
    })();
  }

  createSchedule(payload) {
    const targets = this.getTargets(payload).slice();
    if (targets.length === 0) throw new Error('At least one process target is required for schedule.');
    let runAt = payload.runAt ? new Date(payload.runAt) : null;
    if (!runAt && Number(payload.delaySeconds) > 0) runAt = new Date(Date.now() + Number(payload.delaySeconds) * 1000);
    const kind = payload.dailyTime ? 'Daily' : 'Once';
    if (kind === 'Once' && !runAt) runAt = new Date();
    return {
      scheduleId: payload.scheduleId ? String(payload.scheduleId).trim()
        : `ATK-${formatStamp(new Date())}-${Math.random().toString(36).slice(2, 10)}`.slice(0, 31),
      enabled: true,
      kind,
      processNames: targets,
      matchMode: payload.matchMode ? String(payload.matchMode).trim() : this.options.matchMode,
      runAt: runAt ? runAt.toISOString() : null,
      dailyTime: payload.dailyTime ? String(payload.dailyTime).trim() : null,
      daysOfWeek: (payload.daysOfWeek ?? []).filter(Boolean).map(day => String(day).trim()),
      reason: payload.reason ?? null,
      lastTriggeredDate: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
  }

  loadSavedSchedules() {
    try {
      if (!fs.existsSync(this.scheduleStorePath)) return;
      const saved = JSON.parse(fs.readFileSync(this.scheduleStorePath, 'utf8'));
      if (!Array.isArray(saved)) return;
      for (const schedule of saved) {
        const index = this.schedules.findIndex(item => item.scheduleId === schedule.scheduleId);
        if (index >= 0) this.schedules.splice(index, 1);
        this.schedules.push(schedule);
      }
    } catch (err) {
      this.logger.errorException('Failed to load Auto Task Kill schedules.', err);
    }
  }

  saveSchedules() {
    try {
      fs.mkdirSync(path.dirname(this.scheduleStorePath), { recursive: true });
      fs.writeFileSync(this.scheduleStorePath, JSON.stringify(this.schedules, null, 2));
    } catch (err) {
      this.logger.errorException('Failed to save Auto Task Kill schedules.', err);
    }
  }

  // ── Killing ───────────────────────────────────────────────────────────────

  getConfiguredTargets() {
    return normalizeTargets(this.options.defaultTargets ?? []);
  }

  getTargets(payload) {
    const targets = [];
    if (payload.processName) targets.push(payload.processName);
    if (Array.isArray(payload.processNames)) targets.push(...payload.processNames);
    else if (payload.processNames) targets.push(...String(payload.processNames).split(/[;,]/));
    if (targets.length === 0) targets.push(...this.getConfiguredTargets());
    return normalizeTargets(targets);
  }

  isContainsMode(mode) {
    if (mode) return String(mode).toLowerCase() === 'contains';
    return this.options.allowContainsMatch !== false;
  }

  async killTargets(rawTargets, matchMode, reason) {
    const result = { matchedCount: 0, killedCount: 0, skippedCount: 0, messages: [] };
    const targets = normalizeTargets(rawTargets ?? []);
    if (targets.length === 0) {
      result.messages.push('No target process configured.');
      return result;
    }
    if (process.platform !== 'win32') {
      result.messages.push('Process killing is only supported on Windows.');
      return result;
    }

    const contains = this.isContainsMode(matchMode);
    const protectedNames = new Set(
      (this.options.protectedProcessNames ?? []).map(normalizeProcessName),
    );
    protectedNames.add('ifess-client-app');
    protectedNames.add('ifess.superapp');

    let processes;
    try {
      processes = listProcesses();
    } catch (err) {
      result.skippedCount += 1;
      result.messages.push(`Failed to list processes: ${sanitizeLog(err.message)}`);
      return result;
    }

    for (const proc of processes) {
      const normalized = normalizeProcessName(proc.name);
      if (proc.pid === process.pid || proc.pid === 0) continue;
      if (protectedNames.has(normalized)) continue;
      const matched = contains
        ? targets.some(target => normalized.includes(target))
        : targets.includes(normalized);
      if (!matched) continue;

      result.matchedCount++;
      try {
        killProcessTree(proc.pid, this.options.stopTimeoutSeconds);
        result.killedCount++;
        result.messages.push(`Killed ${proc.name} PID=${proc.pid}.`);
        this.logger.info(`Killed process ${proc.name} PID=${proc.pid}. Reason=${reason}.`);
      } catch (err) {
        result.skippedCount++;
        result.messages.push(`Failed ${proc.name} PID=${proc.pid}: ${err.message}`);
        this.logger.warning(`Failed to kill process ${proc.name} PID=${proc.pid}: ${err.message}`);
      }
    }

    if (result.matchedCount === 0) result.messages.push('No running process matched target list.');
    return result;
  }
}

// ── Process helpers (Windows) ───────────────────────────────────────────────

function listProcesses() {
  // tasklist /FO CSV /NH -> "name","pid",...
  const output = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], {
    windowsHide: true,
    encoding: 'utf8',
    timeout: 15000,
  });
  const processes = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim().startsWith('"')) continue;
    const cells = parseCsvLine(line);
    if (cells.length < 2) continue;
    const pid = Number(cells[1]);
    if (!Number.isFinite(pid)) continue;
    processes.push({ name: cells[0], pid });
  }
  return processes;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { cells.push(current); current = ''; continue; }
    current += ch;
  }
  cells.push(current);
  return cells;
}

function killProcessTree(pid, stopTimeoutSeconds) {
  const args = ['/PID', String(pid), '/T', '/F'];
  try {
    execFileSync('taskkill', args, {
      windowsHide: true,
      encoding: 'utf8',
      timeout: Math.min(30000, Math.max(1, Number(stopTimeoutSeconds ?? 5)) * 1000 + 5000),
    });
  } catch (err) {
    throw new Error(sanitizeLog(err.message));
  }
}

// ── Pure helpers (also used by tests) ───────────────────────────────────────

export function normalizeTargets(targets) {
  const seen = new Set();
  const out = [];
  for (const target of targets ?? []) {
    const normalized = normalizeProcessName(target);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export function normalizeProcessName(value) {
  let text = String(value ?? '').trim().replace(/^"|"$/g, '');
  if (text.toLowerCase().endsWith('.exe')) text = text.slice(0, -4);
  return text;
}

export function isDue(schedule, timestamp) {
  if (!schedule?.enabled) return false;
  const local = toLocalParts(timestamp);

  if (String(schedule.kind ?? '').toLowerCase() === 'once') {
    if (!schedule.runAt) return false;
    return timestamp.getTime() >= new Date(schedule.runAt).getTime();
  }

  if (String(schedule.kind ?? '').toLowerCase() !== 'daily' || !schedule.dailyTime) return false;
  const parts = /^(\d{1,2}):(\d{2})$/.exec(String(schedule.dailyTime).trim());
  if (!parts) return false;
  const hour = Number(parts[1]);
  const minute = Number(parts[2]);
  if (schedule.lastTriggeredDate === local.today) return false;
  if ((schedule.daysOfWeek ?? []).length > 0
    && !(schedule.daysOfWeek ?? []).some(day => day.toLowerCase() === local.dayName.toLowerCase())) {
    return false;
  }
  return local.hour === hour && local.minute === minute;
}

export function markTriggered(schedules, scheduleId, timestamp = new Date()) {
  const schedule = schedules.find(item => item.scheduleId === scheduleId);
  if (!schedule) return;
  if (String(schedule.kind ?? '').toLowerCase() === 'once') {
    schedule.enabled = false;
    schedule.completedAt = timestamp.toISOString();
  }
  schedule.lastTriggeredDate = toLocalParts(timestamp).today;
}

function pruneSeenCommands(seen, cutoffMs = Date.now() - 10 * 60 * 1000) {
  for (const [commandId, seenAt] of seen) {
    if (seenAt < cutoffMs) seen.delete(commandId);
  }
}

function toLocalParts(timestamp) {
  const pad = n => String(n).padStart(2, '0');
  const today = `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}`;
  return {
    today,
    hour: timestamp.getHours(),
    minute: timestamp.getMinutes(),
    dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][timestamp.getDay()],
  };
}

function formatStamp(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function ok(message) { return { success: true, message }; }
function failed(message) { return { success: false, message }; }
