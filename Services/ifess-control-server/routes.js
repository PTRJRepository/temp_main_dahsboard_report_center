/**
 * IFESS Control Server - Express Router
 *
 * Integrates all IFESS Control Server API endpoints into the main Express gateway.
 * Mirrors the .NET IFESS.ControlServer.Api endpoints.
 */

const express = require('express');
const router = express.Router();
const service = require('./service');
const auth = require('./auth');

// ============================================
// API ROUTES
// ============================================

// Health check (public)
router.get('/health', (req, res) => {
    res.json({
        status: 'Healthy',
        serverTime: service.getServerTime()
    });
});

// Server info for client discovery (public - no auth required)
router.get('/server-info', (req, res) => {
    try {
        const info = service.getServerInfo();
        res.json(info);
    } catch (error) {
        console.error('[IFESS] Server info error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// ============================================
// CLIENT MANAGEMENT
// ============================================

// Register client
router.post('/clients/register', (req, res) => {
    try {
        const request = req.body;
        if (!request.clientId) {
            return res.status(400).json({
                error: 'ValidationError',
                message: 'clientId is required'
            });
        }

        const result = service.registerClient(request);
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Register client error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// List all clients
router.get('/clients', (req, res) => {
    try {
        const clients = service.listClients();
        res.json(clients);
    } catch (error) {
        console.error('[IFESS] List clients error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Get specific client
router.get('/clients/:clientId', (req, res) => {
    try {
        const client = service.getClient(req.params.clientId);
        if (!client) {
            return res.status(404).json({
                error: 'NotFound',
                message: `Client '${req.params.clientId}' was not found.`
            });
        }
        res.json(client);
    } catch (error) {
        console.error('[IFESS] Get client error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Get client configuration
router.get('/clients/:clientId/config', (req, res) => {
    try {
        const config = service.getClientConfig(req.params.clientId);
        if (!config) {
            return res.status(404).json({
                error: 'NotFound',
                message: `Config for client '${req.params.clientId}' was not found.`
            });
        }
        res.json(config);
    } catch (error) {
        console.error('[IFESS] Get client config error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Update client configuration
router.put('/clients/:clientId/config', (req, res) => {
    try {
        const result = service.updateClientConfig(req.params.clientId, req.body);
        if (!result.success) {
            return res.status(404).json({
                error: 'NotFound',
                message: result.error
            });
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Update client config error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Receive heartbeat
router.post('/clients/:clientId/heartbeat', (req, res) => {
    try {
        const result = service.receiveHeartbeat(req.params.clientId, req.body);
        if (!result.success) {
            return res.status(404).json({
                error: 'NotFound',
                message: result.error
            });
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Heartbeat error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Report module status
router.post('/clients/:clientId/modules/status', (req, res) => {
    try {
        const result = service.reportModuleStatus(req.params.clientId, req.body);
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Module status report error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Get module statuses for client
router.get('/clients/:clientId/modules/status', (req, res) => {
    try {
        const statuses = service.listModuleStatuses(req.params.clientId);
        res.json(statuses);
    } catch (error) {
        console.error('[IFESS] List module statuses error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// ============================================
// COMMAND MANAGEMENT
// ============================================

// Create command for client
router.post('/clients/:clientId/commands', (req, res) => {
    try {
        const command = service.createCommand(req.params.clientId, req.body);
        res.json(command);
    } catch (error) {
        console.error('[IFESS] Create command error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Poll pending commands
router.get('/clients/:clientId/commands/pending', (req, res) => {
    try {
        const commands = service.pollPendingCommands(req.params.clientId);
        res.json({ commands });
    } catch (error) {
        console.error('[IFESS] Poll commands error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Report command result
router.post('/clients/:clientId/commands/:commandId/result', (req, res) => {
    try {
        const result = service.reportCommandResult(
            req.params.clientId,
            req.params.commandId,
            req.body
        );
        if (!result.success) {
            return res.status(404).json({
                error: 'NotFound',
                message: result.error
            });
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Command result error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// ============================================
// GLOBAL QUERIES
// ============================================

// List all module statuses
router.get('/module-statuses', (req, res) => {
    try {
        const clientId = req.query.clientId || null;
        const statuses = service.listModuleStatuses(clientId);
        res.json(statuses);
    } catch (error) {
        console.error('[IFESS] Module statuses error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// List commands with filters
router.get('/commands', (req, res) => {
    try {
        const clientId = req.query.clientId || null;
        const status = req.query.status || null;
        const commands = service.listCommands(clientId, status);
        res.json(commands);
    } catch (error) {
        console.error('[IFESS] List commands error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// Dashboard summary
router.get('/dashboard', (req, res) => {
    try {
        const summary = service.getDashboardSummary();
        res.json(summary);
    } catch (error) {
        console.error('[IFESS] Dashboard error:', error);
        res.status(500).json({
            error: 'ServerError',
            message: error.message
        });
    }
});

// ============================================
// CLIENT GROUPS
// ============================================

router.post('/client-groups', (req, res) => {
    try {
        const result = service.createClientGroup(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Create client group error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.get('/client-groups', (req, res) => {
    try {
        const groups = service.listClientGroups();
        res.json(groups);
    } catch (error) {
        console.error('[IFESS] List client groups error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.get('/client-groups/:groupCode', (req, res) => {
    try {
        const group = service.getClientGroup(req.params.groupCode);
        if (!group) {
            return res.status(404).json({ error: 'NotFound', message: 'Group not found' });
        }
        res.json(group);
    } catch (error) {
        console.error('[IFESS] Get client group error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.put('/client-groups/:groupCode', (req, res) => {
    try {
        const result = service.updateClientGroup(req.params.groupCode, req.body);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Update client group error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.delete('/client-groups/:groupCode', (req, res) => {
    try {
        const result = service.deleteClientGroup(req.params.groupCode);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Delete client group error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.post('/client-groups/:groupCode/clients/:clientId', (req, res) => {
    try {
        const result = service.addClientToGroup(req.params.groupCode, req.params.clientId);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Add client to group error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.delete('/client-groups/:groupCode/clients/:clientId', (req, res) => {
    try {
        const result = service.removeClientFromGroup(req.params.groupCode, req.params.clientId);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Remove client from group error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

// ============================================
// AUDIT LOG
// ============================================

router.get('/audit-logs', (req, res) => {
    try {
        const filters = {};
        if (req.query.objectType) filters.objectType = req.query.objectType;
        if (req.query.objectId) filters.objectId = req.query.objectId;
        if (req.query.action) filters.action = req.query.action;
        if (req.query.actorId) filters.actorId = req.query.actorId;
        const logs = service.listAuditLogs(filters);
        res.json(logs);
    } catch (error) {
        console.error('[IFESS] List audit logs error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

// ============================================
// QUERY GATEWAY
// ============================================

router.post('/query-gateway/validate', (req, res) => {
    try {
        const { queryText } = req.body;
        const validation = service.isReadOnlySql(queryText);
        res.json(validation);
    } catch (error) {
        console.error('[IFESS] Query validation error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.post('/query-gateway/dispatch', (req, res) => {
    try {
        const result = service.createQueryBatch(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Query dispatch error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.get('/query-gateway/batches', (req, res) => {
    try {
        const batches = service.listQueryBatches();
        res.json(batches);
    } catch (error) {
        console.error('[IFESS] List query batches error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.get('/query-gateway/batches/:batchId', (req, res) => {
    try {
        const batch = service.getQueryBatch(req.params.batchId);
        if (!batch) {
            return res.status(404).json({ error: 'NotFound', message: 'Batch not found' });
        }
        res.json(batch);
    } catch (error) {
        console.error('[IFESS] Get query batch error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.post('/query-gateway/jobs/:jobId/result', (req, res) => {
    try {
        const result = service.storeQueryJobResult({
            queryJobId: req.params.jobId,
            clientId: req.body.clientId,
            headers: req.body.headers,
            rows: req.body.rows,
            rowCount: req.body.rowCount,
            isTruncated: req.body.isTruncated,
            executionTimeMs: req.body.executionTimeMs,
            status: req.body.status,
            errorMessage: req.body.errorMessage
        });
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Store query result error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.post('/query-gateway/jobs/:jobId/chunks', (req, res) => {
    try {
        const result = service.storeQueryResultChunk({
            queryJobId: req.params.jobId,
            clientId: req.body.clientId,
            chunkIndex: req.body.chunkIndex,
            headers: req.body.headers,
            rows: req.body.rows,
            isLastChunk: req.body.isLastChunk
        });
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Store query chunk error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.get('/query-gateway/templates', (req, res) => {
    try {
        const templates = service.listQueryTemplates();
        res.json(templates);
    } catch (error) {
        console.error('[IFESS] List query templates error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.post('/query-gateway/templates', (req, res) => {
    try {
        const result = service.createQueryTemplate(req.body);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Create query template error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.put('/query-gateway/templates/:templateCode', (req, res) => {
    try {
        const result = service.updateQueryTemplate(req.params.templateCode, req.body);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Update query template error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

router.delete('/query-gateway/templates/:templateCode', (req, res) => {
    try {
        const result = service.deleteQueryTemplate(req.params.templateCode);
        if (!result.success) {
            return res.status(404).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('[IFESS] Delete query template error:', error);
        res.status(500).json({ error: 'ServerError', message: error.message });
    }
});

// ============================================
// EXPORTS
// ============================================

module.exports = {
    router,
    auth,
    service
};
