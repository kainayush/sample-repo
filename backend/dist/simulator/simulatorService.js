"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSimulatorConfig = getSimulatorConfig;
exports.setSimulatorBreak = setSimulatorBreak;
exports.setSimulatorStaleness = setSimulatorStaleness;
exports.toggleSimulator = toggleSimulator;
exports.startSimulator = startSimulator;
exports.stopSimulator = stopSimulator;
exports.tickSimulator = tickSimulator;
const database_1 = require("../db/database");
const breakDetector_1 = require("../algorithm/breakDetector");
const wsServer_1 = require("../websocket/wsServer");
const config = {
    isRunning: true,
    intervalMs: 1500,
    breakPosition: null,
    feederId: 'FDR-ALPHA-01',
    simulateStaleness: false,
};
let timerId = null;
const METER_IDS = ['MTR-01', 'MTR-02', 'MTR-03', 'MTR-04', 'MTR-05', 'MTR-06'];
function getSimulatorConfig() {
    return { ...config };
}
function setSimulatorBreak(position) {
    config.breakPosition = position;
    console.log(`[Simulator] Break state changed: Break at position ${position ?? 'NONE (NORMAL)'}`);
    tickSimulator(); // Run immediate tick
    return getSimulatorConfig();
}
function setSimulatorStaleness(enabled) {
    config.simulateStaleness = enabled;
    console.log(`[Simulator] Staleness simulation: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    tickSimulator();
    return getSimulatorConfig();
}
function toggleSimulator(running) {
    config.isRunning = running !== undefined ? running : !config.isRunning;
    if (config.isRunning && !timerId) {
        startSimulator();
    }
    else if (!config.isRunning && timerId) {
        stopSimulator();
    }
    return getSimulatorConfig();
}
function startSimulator() {
    if (timerId)
        clearInterval(timerId);
    config.isRunning = true;
    timerId = setInterval(() => {
        tickSimulator();
    }, config.intervalMs);
    console.log(`[Simulator] Auto-telemetry generation started (Interval: ${config.intervalMs}ms)`);
}
function stopSimulator() {
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    config.isRunning = false;
    console.log('[Simulator] Auto-telemetry generation stopped.');
}
function tickSimulator() {
    const timestamp = new Date().toISOString();
    const readings = [];
    for (let i = 0; i < METER_IDS.length; i++) {
        const meterId = METER_IDS[i];
        const position = i + 1; // 1-indexed topology position
        const isDownstreamOfBreak = config.breakPosition !== null && position >= config.breakPosition;
        if (isDownstreamOfBreak && config.simulateStaleness) {
            // Omit reading generation to test staleness timeout
            continue;
        }
        let voltage;
        let current;
        if (isDownstreamOfBreak) {
            // Conductor snapped/broken - near zero voltage & current
            voltage = Math.max(0, Math.random() * 5.0); // 0V to 5V noise
            current = Math.max(0, Math.random() * 0.1);
        }
        else {
            // Normal healthy operation - 230V nominal with small variation
            voltage = 230 + (Math.random() * 6 - 3); // 227V - 233V
            current = 5.0 + (Math.random() * 1.6 - 0.8); // 4.2A - 5.8A
        }
        readings.push({
            meter_id: meterId,
            voltage: Number(voltage.toFixed(2)),
            current: Number(current.toFixed(2)),
            recorded_at: timestamp
        });
    }
    if (readings.length > 0) {
        (0, database_1.insertReadingsBatch)(readings);
    }
    // Run break detection algorithm and push via WebSocket
    const detectionResult = (0, breakDetector_1.runBreakDetection)(config.feederId);
    (0, wsServer_1.broadcast)('TELEMETRY_UPDATE', {
        feederId: config.feederId,
        readings,
        timestamp
    });
    (0, wsServer_1.broadcast)('DETECTION_RESULT', detectionResult);
}
