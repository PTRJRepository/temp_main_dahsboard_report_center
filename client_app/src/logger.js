'use strict';

import fs from 'node:fs';
import path from 'node:path';

const extraRedactions = new Set();

/** Register a secret (e.g. DB password) so it never reaches logs. */
export function registerRedaction(secret) {
  if (secret && String(secret).length >= 4) extraRedactions.add(String(secret));
}

/** Redact obvious secrets before writing to disk/console. */
export function sanitize(message) {
  let text = String(message ?? '').replace(/masterkey/gi, '<redacted>');
  for (const secret of extraRedactions) {
    text = text.split(secret).join('<redacted>');
  }
  return text;
}

/**
 * Daily file logger, port of IFESS.SuperApp HostLogger/ModuleLogService.
 * Layout:
 *   <rootPath>/host/YYYY-MM-DD.log
 *   <rootPath>/modules/<CODE>/YYYY-MM-DD.log
 */
export class Logger {
  /**
   * @param {string} rootPath absolute base dir for logs
   * @param {{retainDays?: number, console?: boolean}} options
   * @param {string} category 'host' or module code
   */
  constructor(rootPath, options = {}, category = 'host') {
    this.rootPath = rootPath;
    this.category = category;
    this.retainDays = Math.max(1, Number(options.retainDays ?? 14));
    this.console = options.console !== false;
  }

  forModule(moduleCode) {
    return new Logger(this.rootPath, { retainDays: this.retainDays, console: this.console }, moduleCode);
  }

  info(message) { this.write('INFO', message); }
  warning(message) { this.write('WARN', message); }
  error(message) { this.write('ERROR', message); }

  errorException(message, err) {
    const detail = err && err.stack ? err.stack : String(err);
    this.write('ERROR', `${message} ${detail}`);
  }

  write(level, message) {
    const line = `[${new Date().toISOString()}] [${level}] ${sanitize(message)}`;
    if (this.console) {
      if (level === 'ERROR') console.error(line);
      else console.log(line);
    }
    try {
      const day = new Date().toISOString().slice(0, 10);
      const dir = path.join(this.rootPath, this.category === 'host' ? 'host' : path.join('modules', this.category));
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(path.join(dir, `${day}.log`), line + '\n');
    } catch {
      // logging must never crash the client
    }
  }
}

export function cleanupOldLogs(rootPath, retainDays) {
  const days = Math.max(1, Number(retainDays || 14));
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  pruneDir(path.join(rootPath, 'host'), cutoff);
  try {
    for (const entry of fs.readdirSync(path.join(rootPath, 'modules'), { withFileTypes: true })) {
      if (entry.isDirectory()) pruneDir(path.join(rootPath, 'modules', entry.name), cutoff);
    }
  } catch { /* missing dir is fine */ }
}

function pruneDir(dir, cutoff) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const full = path.join(dir, entry.name);
      try {
        if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true });
      } catch { /* ignore */ }
    }
  } catch { /* missing dir is fine */ }
}
