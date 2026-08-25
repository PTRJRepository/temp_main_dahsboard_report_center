'use strict';

/**
 * HTTP client for IFESS Control Server (js-server port 8003, direct or via
 * Main Dashboard reverse proxy). Endpoint contract mirrors ControlServerClient.cs:
 *
 *   POST api/clients/register
 *   POST api/clients/{id}/heartbeat
 *   GET  api/clients/{id}/commands/pending?limit=N
 *   GET  api/clients/{id}/config
 *   POST api/clients/{id}/commands/{commandId}/result
 *   POST api/query-gateway/jobs/{jobId}/result
 *   POST api/query-gateway/jobs/{jobId}/chunks
 */
export class ControlServerClient {
  constructor(options) {
    this.baseUrl = String(options.baseUrl || '').replace(/\/+$/, '');
    this.apiKey = options.apiKey;
    this.clientId = options.clientId;
    this.timeoutMs = Math.max(1, Number(options.requestTimeoutSeconds ?? 5)) * 1000;
  }

  async register(body) {
    return this.post('api/clients/register', body);
  }

  async sendHeartbeat(body) {
    return this.post(`api/clients/${encodeURIComponent(this.clientId)}/heartbeat`, body);
  }

  async getConfig() {
    return this.get(`api/clients/${encodeURIComponent(this.clientId)}/config`);
  }

  async pollPendingCommands(limit) {
    const capped = Math.max(1, Number(limit || 20));
    const data = await this.get(`api/clients/${encodeURIComponent(this.clientId)}/commands/pending?limit=${capped}`);
    return Array.isArray(data?.commands) ? data.commands : [];
  }

  async reportCommandResult(commandId, body) {
    return this.post(
      `api/clients/${encodeURIComponent(this.clientId)}/commands/${encodeURIComponent(commandId)}/result`,
      body,
    );
  }

  async reportQueryResult(queryJobId, body) {
    return this.post(`api/query-gateway/jobs/${encodeURIComponent(queryJobId)}/result`, body);
  }

  async reportQueryChunk(queryJobId, body) {
    return this.post(`api/query-gateway/jobs/${encodeURIComponent(queryJobId)}/chunks`, body);
  }

  async get(pathname) {
    return this.request('GET', pathname);
  }

  async post(pathname, body) {
    return this.request('POST', pathname, body);
  }

  async request(method, pathname, body) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/${pathname}`, {
        method,
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      err.controlServerRequest = `${method} ${pathname}`;
      throw err;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(
        `Control Server request failed: ${response.status} ${response.statusText}. ${text.slice(0, 500)}`,
      );
      error.statusCode = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return await response.text();
    return await response.json();
  }
}
