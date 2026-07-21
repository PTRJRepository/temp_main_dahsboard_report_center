/**
 * sql-gateway.ts
 * Core API client for the SQL Bridge Gateway.
 * Base URL: http://10.0.0.110:3001/query
 * Target database: db_ptrj_mill (READ-ONLY)
 */

import type {
  QueryResponse,
  QueryOptions,
  ServersResponse,
  DatabasesResponse,
  BatchQueryOptions,
  BatchQueryResponse,
} from './types.js';

// ─── Errors ────────────────────────────────────────────────────────────────────

export class SqlGatewayError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly success: false,
    public readonly executionMs: number,
    public readonly db: string | null,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'SqlGatewayError';
  }
}

export class SqlGatewayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqlGatewayConfigError';
  }
}

// ─── Config ────────────────────────────────────────────────────────────────────

export interface SqlGatewayConfig {
  /** HTTP base URL of the SQL Bridge Gateway server. */
  baseUrl: string;
  /** API key transmitted as the `x-api-key` request header. */
  apiKey: string;
  /** Default database name applied when none is supplied on a per-call basis. */
  defaultDatabase?: string;
  /** Default server profile applied when none is supplied on a per-call basis. */
  defaultServer?: string;
  /**
   * When `true`, every outgoing request body is serialised and logged to `console.debug`.
   * Never set this to `true` in production.
   * @default false
   */
  debug?: boolean;
}

const DEFAULT_BASE_URL = 'http://10.0.0.110:8001';
const DEFAULT_DATABASE = 'db_ptrj_mill';
const DEFAULT_SERVER = 'SERVER_PROFILE_1';

/**
 * Build the resolved configuration, filling in defaults.
 */
function resolveConfig(config: Partial<SqlGatewayConfig> & { apiKey: string }): Required<SqlGatewayConfig> {
  return {
    baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    apiKey: config.apiKey,
    defaultDatabase: config.defaultDatabase ?? DEFAULT_DATABASE,
    defaultServer: config.defaultServer ?? DEFAULT_SERVER,
    debug: config.debug ?? false,
  };
}

// ─── Core Request Helper ───────────────────────────────────────────────────────

type HttpMethod = 'GET' | 'POST';

interface RequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  signal?: AbortSignal;
}

async function apiRequest<T>(
  config: Required<SqlGatewayConfig>,
  options: RequestOptions
): Promise<T> {
  const { baseUrl, apiKey, debug } = config;
  const url = `${baseUrl}${options.path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };

  if (debug) {
    console.debug('[SqlGateway DEBUG]', options.method, url, options.body ?? '');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (err) {
    throw new SqlGatewayError(
      `Network error: ${(err as Error).message}`,
      0,
      false,
      0,
      null
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = await response.json() as Record<string, unknown>;
  } catch {
    throw new SqlGatewayError(
      `Invalid JSON response (HTTP ${response.status})`,
      response.status,
      false,
      0,
      null
    );
  }

  if (debug) {
    console.debug('[SqlGateway DEBUG] response:', parsed);
  }

  // Attempt to extract timing and db from successful or error payloads
  const executionMs = typeof parsed['execution_ms'] === 'number'
    ? (parsed['execution_ms'] as number)
    : 0;
  const db = typeof parsed['db'] === 'string' ? (parsed['db'] as string) : null;

  if (!response.ok || parsed['success'] === false) {
    throw new SqlGatewayError(
      (parsed['error'] as string) ?? `HTTP ${response.status}`,
      response.status,
      false,
      executionMs,
      db
    );
  }

  return parsed as T;
}

// ─── SqlGateway Class ──────────────────────────────────────────────────────────

export class SqlGateway {
  private readonly config: Required<SqlGatewayConfig>;

  /**
   * Creates a new SqlGateway client.
   *
   * @example
   * ```ts
   * const db = new SqlGateway({ apiKey: process.env.SQL_GATEWAY_API_KEY! });
   *
   * // Simple read-only query against db_ptrj_mill
   * const rows = await db.query('SELECT TOP 10 * FROM HR_EMPLOYEE');
   * ```
   */
  constructor(config: Partial<SqlGatewayConfig> & { apiKey: string }) {
    if (!config.apiKey) {
      throw new SqlGatewayConfigError('apiKey is required');
    }
    this.config = resolveConfig(config);
  }

  // ─── Query ───────────────────────────────────────────────────────────────────

  /**
   * Execute a **read-only** SQL query against the gateway.
   *
   * The query is validated server-side; any `INSERT`, `UPDATE`, `DELETE`, etc. will
   * be rejected unless the configured server+database profile grants write access.
   *
   * @param sql        - The SQL query string. Parameterised placeholders are supported.
   * @param options.database - Override the default database (`db_ptrj_mill`).
   * @param options.server   - Override the default server profile.
   * @param options.params   - Named parameters for parameterised queries.
   * @param options.signal   - AbortSignal to cancel the request.
   * @returns The query result. **Throws {@link SqlGatewayError} on failure.**
   *
   * @example
   * ```ts
   * const rows = await db.query(
   *   'SELECT TOP 10 EMP_NAME, DEPT FROM HR_EMPLOYEE WHERE DEPT = @dept',
   *   { params: { dept: 'Sales' } }
   * );
   * ```
   */
  async query<T = unknown>(
    sql: string,
    options?: Partial<Pick<QueryOptions, 'database' | 'server' | 'params'>> & {
      signal?: AbortSignal;
    }
  ): Promise<QueryResponse<T>> {
    const body: Record<string, unknown> = { sql };

    if (options?.database !== undefined) body['database'] = options.database;
    if (options?.server !== undefined)    body['server']    = options.server;
    if (options?.params !== undefined)    body['params']    = options.params;

    return apiRequest<QueryResponse<T>>(this.config, {
      method: 'POST',
      path: '/v1/query',
      body,
      signal: options?.signal,
    });
  }

  /**
   * Execute a **read-only** SQL query and return only the `recordset` array.
   *
   * Convenience wrapper — equivalent to `db.query(sql, opts).then(r => r.data.recordset)`.
   *
   * @throws SqlGatewayError if the server rejects the query.
   */
  async queryRows<T = unknown>(
    sql: string,
    options?: Partial<Pick<QueryOptions, 'database' | 'server' | 'params'>> & {
      signal?: AbortSignal;
    }
  ): Promise<T[]> {
    const result = await this.query<T>(sql, options);
    if (!result.data) return [];
    return result.data.recordset as T[];
  }

  // ─── Batch Query ──────────────────────────────────────────────────────────────

  /**
   * Execute multiple queries sequentially (no transaction wrapping in worker mode).
   *
   * All queries are validated for read-only access. The server returns results in
   * the same order as the input array.
   */
  async queryBatch(
    queries: BatchQueryOptions['queries'],
    options?: Partial<Pick<BatchQueryOptions, 'database' | 'server'>> & {
      signal?: AbortSignal;
    }
  ): Promise<BatchQueryResponse> {
    const body: Record<string, unknown> = { queries };

    if (options?.database !== undefined) body['database'] = options.database;
    if (options?.server !== undefined)   body['server']   = options.server;

    return apiRequest<BatchQueryResponse>(this.config, {
      method: 'POST',
      path: '/v1/query/batch',
      body,
      signal: options?.signal,
    });
  }

  // ─── Server / Database Introspection ─────────────────────────────────────────

  /** List all configured server profiles with their connection status. */
  async listServers(signal?: AbortSignal): Promise<ServersResponse> {
    return apiRequest<ServersResponse>(this.config, {
      method: 'GET',
      path: '/v1/servers',
      signal,
    });
  }

  /**
   * List all accessible database names on the target server.
   *
   * @param server - Optional server profile. Defaults to `SERVER_PROFILE_1`.
   */
  async listDatabases(
    server?: string,
    signal?: AbortSignal
  ): Promise<DatabasesResponse> {
    const path = server ? `/v1/databases?server=${encodeURIComponent(server)}` : '/v1/databases';
    return apiRequest<DatabasesResponse>(this.config, {
      method: 'GET',
      path,
      signal,
    });
  }
}

// ─── Default export ─────────────────────────────────────────────────────────────

export default SqlGateway;
