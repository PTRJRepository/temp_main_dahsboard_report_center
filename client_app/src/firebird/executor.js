'use strict';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { resolveIsqlPath } from './tool-resolver.js';

const ISQL_ERROR_MARKERS = [
  'STATEMENT FAILED',
  'DYNAMIC SQL ERROR',
  'SQL ERROR CODE',
  'UNAVAILABLE DATABASE',
  'USE CONNECT OR CREATE DATABASE',
  'YOUR USER NAME AND PASSWORD ARE NOT DEFINED',
  'I/O ERROR',
];

/**
 * Firebird query execution via isql.exe, port of IsqlFallbackQueryExecutor.cs.
 * Writes a temp .sql script (`<query>;\nEXIT;\n`), runs
 * `isql <conn> -u <user> -p <pass> -i tmp.sql -o tmp.txt`, parses the tabular output.
 */
export async function executeFirebirdQuery(payload, options, timeoutMs) {
  const database = options.database || {};
  if (!database.path) throw new Error('Firebird database path is not configured.');
  if (!fs.existsSync(database.path)) {
    throw new Error(`Firebird database file was not found. path=${database.path}`);
  }

  const isqlPath = resolveIsqlPath(database);
  const startedAt = Date.now();
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sqlPath = path.join(os.tmpdir(), `ifess-query-${token}.sql`);
  const outputPath = path.join(os.tmpdir(), `ifess-query-${token}.txt`);

  try {
    const script = `${payload.queryText.trim().replace(/;+\s*$/, '')};\nEXIT;\n`;
    fs.writeFileSync(sqlPath, script, { encoding: 'utf8' }); // no BOM, matches .NET encoder

    const connection = database.useLocalhost === false
      ? database.path
      : `localhost:${database.path}`;
    // SECURITY: password dikirim lewat env ISC_PASSWORD (didukung isql sejak Interbase),
    // BUKAN lewat argv '-p', agar tidak terlihat di process listing (tasklist/wmic).
    const args = [
      connection,
      '-u', String(database.username ?? ''),
      '-i', sqlPath,
      '-o', outputPath,
    ];
    const childEnv = { ...process.env };
    if (database.password) childEnv.ISC_PASSWORD = String(database.password);

    const { stdout, stderr, code } = await runProcess(isqlPath, args, timeoutMs, childEnv);
    const output = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '';
    const diagnostics = [stderr, stdout, output]
      .map(value => (value ?? '').trim())
      .filter(Boolean)
      .join('\n');

    if (code !== 0 || containsIsqlError(diagnostics)) {
      throw new Error(sanitizeError(diagnostics || 'isql.exe returned a non-zero exit code.', database.password));
    }
    if (!output.trim()) {
      throw new Error('isql.exe returned no tabular output. Check Firebird connection, database path, user privilege, and query text.');
    }

    return parseIsqlOutput(output, payload.maxRows, Date.now() - startedAt);
  } finally {
    tryDelete(sqlPath);
    tryDelete(outputPath);
  }
}

function runProcess(file, args, timeoutMs, childEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      windowsHide: true,
      shell: false,
      env: childEnv ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, Math.max(1, timeoutMs));

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        const err = new Error('Query timed out.');
        err.isTimeout = true;
        reject(err);
      } else {
        resolve({ stdout, stderr, code });
      }
    });
  });
}

function killTree(child) {
  try {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      child.kill('SIGKILL');
    }
  } catch { /* best effort */ }
}

/** Port of ParseOutput — parses fixed-width isql table using the separator line ranges. */
export function parseIsqlOutput(output, maxRows, elapsedMs) {
  if (containsIsqlError(output)) {
    throw new Error(sanitizeError(output, null));
  }
  const lines = output.split(/\r\n|\r|\n/).filter(line => line.trim().length > 0);
  const separatorIndex = lines.findIndex(isSeparatorLine);
  if (separatorIndex <= 0) {
    throw new Error('isql.exe output could not be parsed as a SELECT result.');
  }

  const headerLine = lines[separatorIndex - 1];
  const separatorLine = lines[separatorIndex];
  const ranges = getColumnRanges(separatorLine);
  if (ranges.length === 0) {
    throw new Error('isql.exe output did not include column metadata.');
  }

  const headers = ranges.map((range, index) => {
    const name = sliceCell(headerLine, range.start, range.end).trim();
    return name.length > 0 ? name : `COLUMN${index + 1}`;
  });

  const rows = [];
  for (let i = separatorIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (rows.length >= maxRows) break;
    if (containsIsqlError(line)) throw new Error(sanitizeError(line, null));
    if (line.trim() === headerLine.trim() || isSeparatorLine(line)) continue;
    // Skip isql page-footer lines such as "========..." handled above and row-count lines.
    if (/^\s*\d+\s+rows?\w*\s*(fetched|selected)?\s*$/i.test(line)) continue;

    const row = {};
    headers.forEach((header, index) => {
      const range = ranges[index];
      const value = sliceCell(line, range.start, range.end).trim();
      row[header] = value.length > 0 ? value : null;
    });
    rows.push(row);
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
    isTruncated: rows.length >= maxRows,
    executionTimeMs: elapsedMs,
  };
}

function getColumnRanges(separatorLine) {
  const ranges = [];
  let index = 0;
  while (index < separatorLine.length) {
    while (index < separatorLine.length && !isSeparatorCharacter(separatorLine[index])) index++;
    if (index >= separatorLine.length) break;
    const start = index;
    while (index < separatorLine.length && isSeparatorCharacter(separatorLine[index])) index++;
    ranges.push({ start, end: index });
  }
  return ranges;
}

function sliceCell(text, start, end) {
  if (start >= text.length) return '';
  return text.slice(start, Math.min(end, text.length));
}

function isSeparatorLine(line) {
  let hasSeparator = false;
  for (const ch of line) {
    if (/\s/.test(ch)) continue;
    if (!isSeparatorCharacter(ch)) return false;
    hasSeparator = true;
  }
  return hasSeparator;
}

function isSeparatorCharacter(ch) {
  return ch === '=' || ch === '-' || ch === '_';
}

function containsIsqlError(text) {
  if (!text || !text.trim()) return false;
  const normalized = text.toUpperCase();
  return ISQL_ERROR_MARKERS.some(marker => normalized.includes(marker));
}

function sanitizeError(error, password) {
  let sanitized = !error || !error.trim()
    ? 'isql.exe returned a non-zero exit code.'
    : error;
  sanitized = sanitized.replace(/masterkey/gi, '<redacted>');
  if (password) {
    sanitized = sanitized.split(password).join('<redacted>');
  }
  return sanitized.trim();
}

function tryDelete(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
  } catch { /* ignore */ }
}
