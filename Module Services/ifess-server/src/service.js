/**
 * IFESS Server — Business Logic Bridge
 *
 * Re-exports the module-OWNED copy of the canonical CommonJS core at
 * `src/core/service.cjs` (1995 lines: clients, heartbeats, commands, groups,
 * audit logs, query gateway, sync). Copied per the monorepo isolation rule —
 * modules never import outside their folder (docs/MONOREPO.md §2;
 * docs/independence-research.md G2). The original still lives at
 * Services/ifess-control-server/service.js for the legacy in-gateway path
 * until the cut-over removes it; both resolve DATA_DIR to the same shared
 * repo-root `data/ifess` store (env override: IFESS_DATA_DIR).
 */

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// getServerInfo() inside the CJS core advertises this host:port to browsers
// and clients; default there is the gateway (:3001). When we are the direct
// endpoint, advertise our own port unless explicitly overridden.
process.env.IFESS_SERVER_PORT ||= process.env.IFESS_PORT || '8003';

const here = fileURLToPath(new URL('.', import.meta.url)); // Module Services/ifess-server/src/
const SERVICE_PATH = resolve(here, './core/service.cjs');

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
