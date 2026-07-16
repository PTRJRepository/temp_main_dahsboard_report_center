/**
 * IFESS Control Service — Business Logic
 *
 * Re-exports the ifessService from the canonical module.
 * DATA_DIR is resolved relative to the parent directory of this service,
 * which resolves to the same `data/ifess` used by server_bun.js.
 *
 * The canonical source of truth is:
 *   Services/ifess-control-server/service.js
 *
 * This module exists to provide a stable ESM import surface for the
 * standalone HTTP service. No business logic lives here.
 */

import { resolve } from 'node:path';
import { createRequire } from 'node:module';

// Resolve to the canonical CommonJS service module.
// import.meta.dirname = Services/ifess-control-service/src/
// ../../../Services/ = project root/Services/
const SERVICE_PATH = resolve(import.meta.dirname, '../../../Services/ifess-control-server/service.js');
const require = createRequire(import.meta.url);
const ifessService = require(SERVICE_PATH);

export default ifessService;

// Re-export every named export for convenience
export const {
    ClientStatus,
    ModuleRuntimeStatus,
    CommandType,
    CommandStatus,
    ScheduleMode,
    registerClient,
    listClients,
    getClient,
    getClientConfig,
    updateClientConfig,
    receiveHeartbeat,
    reportModuleStatus,
    listModuleStatuses,
    createCommand,
    pollPendingCommands,
    reportCommandResult,
    listCommands,
    getDashboardSummary,
    getServerInfo,
    listSyncDivisions,
    resolveDivision,
    createSyncJob,
    getSyncJob,
    listSyncJobs,
    updateSyncJob,
    reapStaleCommands,
    createAuditLog,
    listAuditLogs,
    createClientGroup,
    listClientGroups,
    getClientGroup,
    updateClientGroup,
    deleteClientGroup,
    addClientToGroup,
    removeClientFromGroup,
    isReadOnlySql,
    createQueryBatch,
    getQueryBatch,
    storeQueryJobResult,
    storeQueryResultChunk,
    listQueryBatches,
    listQueryTemplates,
    createQueryTemplate,
    updateQueryTemplate,
    deleteQueryTemplate,
    generateId,
    getServerTime,
    loadAll,
    saveAll,
} = ifessService;
