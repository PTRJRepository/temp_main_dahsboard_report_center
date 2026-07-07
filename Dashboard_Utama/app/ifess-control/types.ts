export interface Client {
  clientId: string;
  clientName: string;
  machineName?: string;
  environment?: string;
  appVersion?: string;
  os?: string;
  status: string;
  uptimeSeconds?: number;
  lastHeartbeatAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModuleStatus {
  clientId: string;
  moduleCode: string;
  status: string;
  pid?: number;
  restartCount: number;
  lastError?: string;
}

export interface Command {
  commandId: string;
  clientId: string;
  commandType: string;
  moduleCode?: string;
  status: string;
  message?: string;
  createdAt: string;
  receivedAt?: string;
  executedAt?: string;
}

export interface ClientGroup {
  groupCode: string;
  groupName: string;
  description?: string;
  clients?: string[];
  createdAt?: string;
}

export interface QueryTemplate {
  templateCode: string;
  templateName: string;
  description?: string;
  queryText: string;
  defaultMaxRows: number;
  defaultTimeoutSeconds: number;
  tags?: string[];
  enabled: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueryBatch {
  queryBatchId: string;
  queryName: string;
  queryText: string;
  targetMode: string;
  targetGroup?: string;
  requestedBy: string;
  maxRows: number;
  timeoutSeconds: number;
  status: string;
  totalTarget: number;
  successCount: number;
  failedCount: number;
  rejectedCount: number;
  timeoutCount: number;
  createdAt: string;
  completedAt?: string;
}

export interface QueryJob {
  queryJobId: string;
  queryBatchId: string;
  targetClientId: string;
  status: string;
  rowCount: number;
  isTruncated: boolean;
  executionTimeMs?: number;
  errorMessage?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface AuditLog {
  auditId: string;
  actorId: string;
  actorName: string;
  action: string;
  objectType: string;
  objectId?: string;
  beforeValue?: unknown;
  afterValue?: unknown;
  status: string;
  timestamp: string;
}

export type ExplorerNodeType =
  | 'dashboard'
  | 'clients'
  | 'client'
  | 'client-status'
  | 'client-groups'
  | 'client-group'
  | 'modules'
  | 'module'
  | 'commands'
  | 'command-status'
  | 'query-gateway'
  | 'query-editor'
  | 'query-templates'
  | 'query-history'
  | 'configuration'
  | 'client-config'
  | 'audit-logs'
  | 'properties'
  | 'heartbeat-logs';

export interface ExplorerNode {
  id: string;
  type: ExplorerNodeType;
  label: string;
  parentId?: string;
  status?: string;
  icon?: string;
  data?: unknown;
}
