'use strict';

import fs from 'node:fs';
import path from 'node:path';

/**
 * Durable local outbox for query results that failed to send, port of
 * QueryResultOutbox.cs. Files are written atomically (.tmp -> rename) and
 * flushed automatically when the control server is reachable again.
 */
export class QueryResultOutbox {
  constructor(policyOptions, baseDirectory) {
    this.enabled = policyOptions.resultOutboxEnabled !== false;
    this.directory = resolvePath(policyOptions.resultOutboxPath, baseDirectory);
    this.maxFiles = Math.max(1, Number(policyOptions.resultOutboxMaxFiles ?? 1000));
  }

  async save(envelopes) {
    if (!this.enabled || !envelopes.length) return;
    fs.mkdirSync(this.directory, { recursive: true });
    for (const envelope of envelopes) {
      if (!envelope.queryJobId) continue;
      const envelopeId = envelope.envelopeId || randomId();
      const fileName = `${timestampPrefix()}-${safeFilePart(envelope.queryJobId)}-${envelopeId}.json`;
      const finalPath = path.join(this.directory, fileName);
      const tempPath = `${finalPath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(envelope));
      fs.renameSync(tempPath, finalPath);
    }
    this.pruneOldFiles();
  }

  async loadBatch(maxItems) {
    if (!this.enabled || !fs.existsSync(this.directory)) return [];
    const files = fs.readdirSync(this.directory)
      .filter(name => name.endsWith('.json'))
      .sort()
      .slice(0, Math.max(1, maxItems));
    const items = [];
    for (const name of files) {
      const filePath = path.join(this.directory, name);
      try {
        const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (!envelope || !envelope.queryJobId) {
          moveAside(filePath);
          continue;
        }
        items.push({ filePath, envelope });
      } catch {
        moveAside(filePath);
      }
    }
    return items;
  }

  async remove(filePath) {
    try {
      if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true });
    } catch { /* ignore */ }
  }

  pruneOldFiles() {
    if (!fs.existsSync(this.directory)) return;
    const files = fs.readdirSync(this.directory)
      .filter(name => name.endsWith('.json'))
      .sort()
      .reverse();
    for (const name of files.slice(this.maxFiles)) {
      try { fs.rmSync(path.join(this.directory, name), { force: true }); } catch { /* ignore */ }
    }
  }
}

function resolvePath(configuredPath, baseDirectory) {
  let value = configuredPath && String(configuredPath).trim()
    ? String(configuredPath)
    : path.join('data', 'query-gateway-outbox');
  return path.isAbsolute(value) ? value : path.join(baseDirectory, value);
}

function moveAside(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.renameSync(filePath, `${filePath}.bad`);
  } catch { /* ignore */ }
}

function timestampPrefix() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 17); // yyyyMMddHHmmssSSS
}

function safeFilePart(value) {
  const safe = String(value).replace(/[^A-Za-z0-9_-]/g, '_').replace(/^_+|_+$/g, '');
  return safe.length > 0 ? safe : 'query-job';
}

function randomId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
