'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * isql.exe locator, port of FirebirdToolResolver.cs.
 * Search order: configured isqlPath, firebirdBinPath, FIREBIRD_HOME,
 * app base folder (+Firebird subfolders), Program Files candidates, PATH.
 */

const ISQL_FILE = 'isql.exe';

export function resolveIsqlPath(database) {
  const seen = new Set();
  const candidates = [];
  for (const candidate of enumerateIsqlCandidates(database)) {
    if (!candidate) continue;
    const normalized = normalizePath(candidate);
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(normalized);
  }

  const found = candidates.find(candidate => {
    try { return fs.existsSync(candidate) && fs.statSync(candidate).isFile(); } catch { return false; }
  });
  if (found) return found;

  const checked = candidates.length > 0 ? candidates.join('; ') : '<no candidate paths>';
  throw new Error(
    `isql.exe was not found. Set database.isqlPath to the full isql.exe path, ` +
    `or set database.firebirdBinPath to the Firebird bin folder. Checked: ${checked}`,
  );
}

function* enumerateIsqlCandidates(database) {
  yield* expandConfiguredPath(database.isqlPath);
  yield* expandConfiguredPath(database.firebirdBinPath);
  yield* expandConfiguredPath(process.env.FIREBIRD_HOME);

  yield path.join(appBaseDir(), ISQL_FILE);
  yield path.join(appBaseDir(), 'Firebird', ISQL_FILE);
  yield path.join(appBaseDir(), 'Firebird', 'bin', ISQL_FILE);

  for (const root of programFilesRoots()) {
    yield* programFilesCandidates(root);
  }
  yield* pathCandidates();
}

function* expandConfiguredPath(configuredPath) {
  if (!configuredPath || !String(configuredPath).trim()) return;
  const value = String(configuredPath).trim().replace(/^"|"$/g, '');
  if (path.basename(value).toLowerCase() === ISQL_FILE) {
    yield value;
    return;
  }
  yield path.join(value, ISQL_FILE);
  yield path.join(value, 'bin', ISQL_FILE);
}

function programFilesRoots() {
  return [
    process.env['ProgramFiles(x86)'],
    process.env.ProgramFiles,
  ].filter(Boolean);
}

function* programFilesCandidates(root) {
  const firebirdRoot = path.join(root, 'Firebird');
  yield path.join(root, 'Firebird-1.5.6.5026-0_win32_Manual', 'bin', ISQL_FILE);
  for (const version of ['Firebird_1_5', 'Firebird_2_5', 'Firebird_3_0', 'Firebird_4_0', 'Firebird_5_0']) {
    yield path.join(firebirdRoot, version, 'bin', ISQL_FILE);
  }

  for (const dir of listDirs(firebirdRoot)) {
    yield path.join(dir, 'bin', ISQL_FILE);
    yield path.join(dir, ISQL_FILE);
  }
  for (const dir of listDirsMatching(root, /^Firebird/i)) {
    yield path.join(dir, 'bin', ISQL_FILE);
    yield path.join(dir, ISQL_FILE);
  }
}

function* pathCandidates() {
  const pathValue = process.env.PATH || process.env.Path || '';
  for (const dir of pathValue.split(path.delimiter)) {
    if (!dir.trim()) continue;
    yield path.join(dir.trim().replace(/^"|"$/g, ''), ISQL_FILE);
  }
}

function listDirs(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(dir, entry.name))
      .sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
  } catch {
    return [];
  }
}

function listDirsMatching(dir, pattern) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && pattern.test(entry.name))
      .map(entry => path.join(dir, entry.name))
      .sort((a, b) => path.basename(b).localeCompare(path.basename(a)));
  } catch {
    return [];
  }
}

function appBaseDir() {
  // src/firebird/tool-resolver.js -> ../../.. = client_app/
  // fileURLToPath dipakai agar kompatibel Node >= 18 (import.meta.dirname butuh >= 20.11).
  const here = path.dirname(fileURLToPath(import.meta.url)); // <base>/src/firebird
  return path.resolve(here, '..', '..');
}

function normalizePath(value) {
  return path.normalize(String(value));
}
