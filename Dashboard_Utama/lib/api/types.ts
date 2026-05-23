/**
 * types.ts
 * Shared TypeScript types for the SQL Gateway API client.
 * Target: localhost:8001/v1/query — READ-ONLY, db_ptrj_mill
 */

export interface QueryResponse<T = unknown> {
  success: boolean;
  db: string | null;
  execution_ms: number;
  data: {
    recordset: T[];
    rowsAffected: number[];
  } | null;
  error: string | null;
}

export interface QueryOptions {
  sql: string;
  database?: string;
  server?: string;
  params?: Record<string, unknown>;
}

export interface ServerStatus {
  name: string;
  host: string;
  port: number;
  defaultDatabase: string;
  readOnly: boolean;
  connected: boolean;
  healthy: boolean;
}

export interface ServersResponse {
  success: boolean;
  data: {
    servers: ServerStatus[];
    total: number;
    defaultServer: string;
  };
}

export interface DatabasesResponse {
  success: boolean;
  server: string;
  data: {
    databases: string[];
    total: number;
  };
  error: string | null;
}

export interface BatchQueryOptions {
  queries: Array<{
    sql: string;
    params?: Record<string, unknown>;
  }>;
  database?: string;
  server?: string;
}

export interface BatchQueryResponse {
  success: boolean;
  server: string;
  db: string;
  execution_ms: number;
  data: {
    results: Array<{
      recordset: unknown[];
      rowsAffected: number[];
    }>;
    transactionCommitted: boolean;
    note: string;
  } | null;
  error: string | null;
}