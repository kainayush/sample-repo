import { insertReadingsBatch } from '../db/database';
import { runBreakDetection } from '../algorithm/breakDetector';
import { broadcast } from '../websocket/wsServer';

export interface SimulatorConfig {
  isRunning: boolean;
  intervalMs: number;
  breakPosition: number | null; // 1 to 6, or null for normal
  feederId: string;
  simulateStaleness: boolean;
}

const config: SimulatorConfig = {
  isRunning: true,
  intervalMs: 1500,
  breakPosition: null,
  feederId: 'FDR-ALPHA-01',
  simulateStaleness: false,
};

let timerId: NodeJS.Timeout | null = null;

const METER_IDS = ['MTR-01', 'MTR-02', 'MTR-03', 'MTR-04', 'MTR-05', 'MTR-06'];

export function getSimulatorConfig() {
  return { ...config };
}

export function setSimulatorBreak(position: number | null) {
  config.breakPosition = position;
  console.log(`[Simulator] Break state changed: Break at position ${position ?? 'NONE (NORMAL)'}`);
  tickSimulator(); // Run immediate tick
  return getSimulatorConfig();
}

export function setSimulatorStaleness(enabled: boolean) {
  config.simulateStaleness = enabled;
  console.log(`[Simulator] Staleness simulation: ${enabled ? 'ENABLED' : 'DISABLED'}`);
  tickSimulator();
  return getSimulatorConfig();
}

export function toggleSimulator(running?: boolean) {
  config.isRunning = running !== undefined ? running : !config.isRunning;
  if (config.isRunning && !timerId) {
    startSimulator();
  } else if (!config.isRunning && timerId) {
    stopSimulator();
  }
  return getSimulatorConfig();
}

export function startSimulator() {
  if (timerId) clearInterval(timerId);
  config.isRunning = true;
  timerId = setInterval(() => {
    tickSimulator();
  }, config.intervalMs);
  console.log(`[Simulator] Auto-telemetry generation started (Interval: ${config.intervalMs}ms)`);
}

export function stopSimulator() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  config.isRunning = false;
  console.log('[Simulator] Auto-telemetry generation stopped.');
}

export function tickSimulator() {
  const timestamp = new Date().toISOString();
  const readings: Array<{ meter_id: string; voltage: number; current: number; recorded_at: string }> = [];

  for (let i = 0; i < METER_IDS.length; i++) {
    const meterId = METER_IDS[i];
    const position = i + 1; // 1-indexed topology position

    const isDownstreamOfBreak = config.breakPosition !== null && position >= config.breakPosition;

    if (isDownstreamOfBreak && config.simulateStaleness) {
      // Omit reading generation to test staleness timeout
      continue;
    }

    let voltage: number;
    let current: number;

    if (isDownstreamOfBreak) {
      // Conductor snapped/broken - near zero voltage & current
      voltage = Math.max(0, Math.random() * 5.0); // 0V to 5V noise
      current = Math.max(0, Math.random() * 0.1);
    } else {
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
    insertReadingsBatch(readings);
  }

  // Run break detection algorithm and push via WebSocket
  const detectionResult = runBreakDetection(config.feederId);

  broadcast('TELEMETRY_UPDATE', {
    feederId: config.feederId,
    readings,
    timestamp
  });

  broadcast('DETECTION_RESULT', detectionResult);
}
