"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiRouter = void 0;
const express_1 = require("express");
const database_1 = require("../db/database");
const breakDetector_1 = require("../algorithm/breakDetector");
const simulatorService_1 = require("../simulator/simulatorService");
const wsServer_1 = require("../websocket/wsServer");
exports.apiRouter = (0, express_1.Router)();
// GET /api/feeders - List all feeders
exports.apiRouter.get('/feeders', (req, res) => {
    try {
        const feeders = (0, database_1.getAllFeeders)();
        res.json({ success: true, feeders });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/feeders/:id/meters - List meters in topology order with latest reading
exports.apiRouter.get('/feeders/:id/meters', (req, res) => {
    try {
        const feederId = req.params.id;
        const meters = (0, database_1.getMetersByFeeder)(feederId);
        res.json({ success: true, feeder_id: feederId, meters });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/readings - Ingest single or array of smart meter readings (used by real ESP32 nodes or simulator)
exports.apiRouter.post('/readings', (req, res) => {
    try {
        const body = req.body;
        if (Array.isArray(body)) {
            for (const item of body) {
                if (!item.meter_id || item.voltage === undefined || item.current === undefined) {
                    return res.status(400).json({ success: false, error: 'Malformed reading item. Required fields: meter_id, voltage, current.' });
                }
            }
            (0, database_1.insertReadingsBatch)(body);
        }
        else {
            const { meter_id, voltage, current, recorded_at } = body;
            if (!meter_id || voltage === undefined || current === undefined) {
                return res.status(400).json({ success: false, error: 'Malformed reading. Required fields: meter_id, voltage, current.' });
            }
            (0, database_1.insertReading)(meter_id, Number(voltage), Number(current), recorded_at);
        }
        // Default feeder for hackathon single feeder FDR-ALPHA-01
        const feederId = req.query.feeder_id || 'FDR-ALPHA-01';
        // Run core algorithm server-side immediately after ingestion
        const detectionResult = (0, breakDetector_1.runBreakDetection)(feederId);
        // Broadcast live telemetry & detection update via WebSocket
        (0, wsServer_1.broadcast)('DETECTION_RESULT', detectionResult);
        res.json({
            success: true,
            message: 'Reading(s) ingested successfully',
            detectionResult
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/feeders/:id/status - Current fault status for feeder
exports.apiRouter.get('/feeders/:id/status', (req, res) => {
    try {
        const feederId = req.params.id;
        const detectionResult = (0, breakDetector_1.runBreakDetection)(feederId);
        const activeBreak = (0, database_1.getActiveBreakEvent)(feederId);
        res.json({
            success: true,
            feeder_id: feederId,
            status: detectionResult.status,
            active_break: activeBreak || null,
            detectionResult
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// GET /api/alerts - Recent alerts
exports.apiRouter.get('/alerts', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const alerts = (0, database_1.getAlerts)(limit);
        res.json({ success: true, alerts });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/alerts/:id/acknowledge - Mark alert acknowledged
exports.apiRouter.post('/alerts/:id/acknowledge', (req, res) => {
    try {
        const alertId = parseInt(req.params.id, 10);
        (0, database_1.acknowledgeAlert)(alertId);
        // Broadcast updated alerts via WS
        const alerts = (0, database_1.getAlerts)(50);
        (0, wsServer_1.broadcast)('ALERTS_UPDATE', alerts);
        res.json({ success: true, message: `Alert #${alertId} acknowledged successfully.` });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// SIMULATOR ENDPOINTS FOR DASHBOARD DEMO CONTROLS
// GET /api/simulator/config
exports.apiRouter.get('/simulator/config', (req, res) => {
    res.json({ success: true, config: (0, simulatorService_1.getSimulatorConfig)() });
});
// POST /api/simulator/break - Inject break downstream of position
exports.apiRouter.post('/simulator/break', (req, res) => {
    try {
        const { position } = req.body;
        if (position === undefined || position < 1 || position > 6) {
            return res.status(400).json({ success: false, error: 'Invalid meter position. Must be between 1 and 6.' });
        }
        const updatedConfig = (0, simulatorService_1.setSimulatorBreak)(Number(position));
        res.json({ success: true, message: `Conductor break injected downstream of Meter Position ${position}`, config: updatedConfig });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/simulator/restore - Restore line to normal
exports.apiRouter.post('/simulator/restore', (req, res) => {
    try {
        const updatedConfig = (0, simulatorService_1.setSimulatorBreak)(null);
        res.json({ success: true, message: 'Feeder line restored to normal healthy status.', config: updatedConfig });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/simulator/toggle - Start/stop simulator auto generation
exports.apiRouter.post('/simulator/toggle', (req, res) => {
    try {
        const { running } = req.body;
        const updatedConfig = (0, simulatorService_1.toggleSimulator)(running);
        res.json({ success: true, config: updatedConfig });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// POST /api/simulator/staleness - Toggle connection loss simulation
exports.apiRouter.post('/simulator/staleness', (req, res) => {
    try {
        const { enabled } = req.body;
        const updatedConfig = (0, simulatorService_1.setSimulatorStaleness)(!!enabled);
        res.json({ success: true, config: updatedConfig });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
