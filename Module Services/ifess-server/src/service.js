/**
 * IFESS Server — Business Logic Bridge
 *
 * Re-exports the canonical CommonJS service module at
 * `<repo>/Services/ifess-control-server/service.js` (1996 lines: clients,
 * heartbeats, commands, groups, audit logs, query gateway, sync).
 *
 * The bridge exists so the HTTP layer (ESM) can import the CJS core without
 * duplicating logic, and so DATA_DIR resolves to the same `data/ifess` used
 * by server_bun.js — both processes read/write the identical JSON store.
 *
 * NOTE: service.js resolves DATA_DIR relative to its own __dirname
 * (`Services/ifess-control-server/../../data/ifess`), so no override is
 * needed as long as this module lives inside the Main Dashboard repo.
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// getServerInfo() inside the CJS core advertises this host:port to browsers
// and clients; default there is the gateway (:3001). When we are the direct
// endpoint, advertise our own port unless explicitly overridden.
process.env.IFESS_SERVER_PORT ||= process.env.IFESS_PORT || '8012';

const here = fileURLToPath(new URL('.', import.meta.url)); // Module Services/ifess-server/src/
const SERVICE_PATH = resolve(here, '../../../Services/ifess-control-server/service.js');

const require = createRequire(import.meta.url);
const ifessService = require(SERVICE_PATH);

export default ifessService;

export const {
    // Enums
    ClientStatus,
    ModuleRuntimeStatus,
    CommandType,
    CommandStatus,
    ScheduleMode,

    // Clients / heartbeats / commands
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

    // Firebird → SQL sync
    listSyncDivisions,
    resolveDivision,
    createSyncJob,
    getSyncJob,
    listSyncJobs,
    updateSyncJob,

    // Stuck-command reaper
    reapStaleCommands,

    // Audit log
    createAuditLog,
    listAuditLogs,

    // Client groups
    createClientGroup,
    listClientGroups,
    getClientGroup,
    updateClientGroup,
    deleteClientGroup,
    addClientToGroup,
    removeClientFromGroup,

    // Query Gateway
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

    // Utilities
    generateId,
    getServerTime,
    loadAll,
    saveAll,
} = ifessService;
