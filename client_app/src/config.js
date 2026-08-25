'use strict';

import fs from 'node:fs';
import { parseJsonC } from './util/jsonc.js';

/**
 * Default configuration — mirrors IFESS.SuperApp appsettings.json.
 * Any value can be overridden from a config file passed via `--config <path>`.
 * The file may contain // comments (JSONC, same rule as appsettings.json).
 */
export function defaultConfig() {
  return {
    app: {
      name: 'IFESS Client App',
    },
    logging: {
      rootPath: 'logs',
      retainDays: 14,
      console: true,
    },
    controlServer: {
      enabled: true,
      // Mode direct ke IFESS Client Gateway (js-server port 8003):
      //   "http://localhost:8003" atau "http://10.0.0.128:8003"
      // Mode reverse proxy lewat Main Dashboard:
      //   "http://10.0.0.110:3001/ifess"
      baseUrl: 'http://localhost:8003',
      apiKey: '',
      clientId: '',
      clientName: '',
      environment: 'Production',
      heartbeatIntervalSeconds: 15,
      commandPollIntervalSeconds: 5,
      maxCommandsPerPoll: 20,
      requestTimeoutSeconds: 5,
      inflightCommands: 3,
      retry: {
        baseDelaySeconds: 2,
        maxDelaySeconds: 60,
        jitterRatio: 0.2,
      },
    },
    modules: [],
  };
}

export function deepMerge(base, override) {
  if (override === null || typeof override !== 'object' || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  if (base === null || typeof base !== 'object' || Array.isArray(base)) {
    return override;
  }
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return out;
}

export function loadConfig({ configPath } = {}) {
  let merged = defaultConfig();
  if (configPath) {
    const text = fs.readFileSync(configPath, 'utf8');
    merged = deepMerge(merged, parseJsonC(text));
    // Override lokal opsional: <nama-config>.local.json di folder yang sama.
    // Dipakai untuk kredensial/nilai spesifik mesin tanpa menyentuh file utama.
    const localPath = configPath.replace(/\.json$/i, '.local.json');
    if (localPath !== configPath && fs.existsSync(localPath)) {
      merged = deepMerge(merged, parseJsonC(fs.readFileSync(localPath, 'utf8')));
    }
  }
  validateConfig(merged);
  return merged;
}

export function validateConfig(config) {
  const errors = [];
  const cs = config.controlServer;
  if (!cs || typeof cs !== 'object') {
    throw new ConfigError('controlServer section is required.');
  }
  if (cs.enabled) {
    if (!cs.baseUrl || typeof cs.baseUrl !== 'string') errors.push('controlServer.baseUrl is required.');
    if (!cs.apiKey) errors.push('controlServer.apiKey is required.');
    if (!cs.clientId) errors.push('controlServer.clientId is required (contoh: CLIENT-PTRJ-ARE-A).');
    if (!cs.clientName) errors.push('controlServer.clientName is required.');
  }
  if (errors.length > 0) throw new ConfigError(errors.join(' '));
  return config;
}

export class ConfigError extends Error {}
