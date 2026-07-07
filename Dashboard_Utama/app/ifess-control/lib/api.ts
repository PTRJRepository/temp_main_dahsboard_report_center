import type { Client, ClientGroup, Command, ModuleStatus, QueryBatch, QueryJob, QueryTemplate, AuditLog } from '../types';

const API_BASE = '/api/ifess';
const QG_BASE = '/api/query-gateway';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function proxyCall<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  return apiFetch<T>(API_BASE, { method: 'POST', body: JSON.stringify({ action, params }) });
}

export async function qgCall<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  // Dispatch and createTemplate use REST POST paths directly on gateway
  const pathMap: Record<string, string> = {
    validate: `${QG_BASE}/validate`,
    dispatch: `${QG_BASE}/dispatch`,
    createTemplate: `${QG_BASE}/templates`,
  };
  const url = pathMap[action] || QG_BASE;
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(params) });
}

export async function qgGet(action: string, params: Record<string, string> = {}): Promise<unknown> {
  const pathMap: Record<string, (p: Record<string, string>) => string> = {
    listBatches: () => `${QG_BASE}/batches`,
    getBatch: (p) => `${QG_BASE}/batches/${p.batchId}`,
    listTemplates: () => `${QG_BASE}/templates`,
  };
  const builder = pathMap[action];
  if (!builder) throw new Error(`Unknown qgGet action: ${action}`);
  return apiFetch<unknown>(builder(params));
}

export async function listClients(): Promise<Client[]> {
  return proxyCall<Client[]>('listClients', {});
}

export async function listCommands(filters?: { clientId?: string; status?: string }): Promise<Command[]> {
  return proxyCall<Command[]>('listCommands', filters || {});
}

export async function createCommand(params: {
  clientId: string;
  commandType: string;
  moduleCode?: string;
  payload?: Record<string, unknown>;
}): Promise<Command> {
  return proxyCall<Command>('createCommand', params);
}

export async function listModuleStatuses(clientId?: string): Promise<ModuleStatus[]> {
  return proxyCall<ModuleStatus[]>('getModuleStatuses', { clientId });
}

export async function listClientGroups(): Promise<ClientGroup[]> {
  return proxyCall<ClientGroup[]>('listClientGroups', {});
}

export async function createClientGroup(group: Omit<ClientGroup, 'createdAt'>): Promise<{ success: boolean; group: ClientGroup }> {
  return proxyCall<{ success: boolean; group: ClientGroup }>('createClientGroup', group as Record<string, unknown>);
}

export async function listAuditLogs(): Promise<AuditLog[]> {
  return proxyCall<AuditLog[]>('listAuditLogs', {});
}

export async function validateQuery(queryText: string): Promise<{ valid: boolean; errors: string[] }> {
  return qgCall<{ valid: boolean; errors: string[] }>('validate', { queryText });
}

export async function dispatchQuery(params: {
  queryName: string;
  queryText: string;
  targetMode: string;
  targetClientIds?: string[];
  targetGroup?: string;
  maxRows?: number;
  timeoutSeconds?: number;
}): Promise<{ queryBatchId: string; status: string; targetCount: number }> {
  return qgCall<{ queryBatchId: string; status: string; targetCount: number }>('dispatch', params as Record<string, unknown>);
}

export async function listQueryBatches(): Promise<QueryBatch[]> {
  return qgGet('listBatches', {}) as Promise<QueryBatch[]>;
}

export async function getQueryBatch(batchId: string): Promise<QueryBatch & { jobs: QueryJob[]; results: unknown[] }> {
  return qgGet('getBatch', { batchId }) as Promise<QueryBatch & { jobs: QueryJob[]; results: unknown[] }>;
}

export async function listQueryTemplates(): Promise<QueryTemplate[]> {
  return qgGet('listTemplates', {}) as Promise<QueryTemplate[]>;
}

export async function createQueryTemplate(template: Omit<QueryTemplate, 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; template: QueryTemplate }> {
  return qgCall<{ success: boolean; template: QueryTemplate }>('createTemplate', template as Record<string, unknown>);
}
