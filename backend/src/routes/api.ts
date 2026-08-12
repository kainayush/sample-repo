import { Router, Request, Response } from 'express';
import {
  getAllFeeders,
  getMetersByFeeder,
  insertReading,
  insertReadingsBatch,
  getAlerts,
  acknowledgeAlert,
  getActiveBreakEvent
} from '../db/database';
import { runBreakDetection } from '../algorithm/breakDetector';
import {
  getSimulatorConfig,
  setSimulatorBreak,
  setSimulatorStaleness,
  toggleSimulator
} from '../simulator/simulatorService';
import { broadcast } from '../websocket/wsServer';

export const apiRouter = Router();

// GET /api/feeders - List all feeders
apiRouter.get('/feeders', (req: Request, res: Response) => {
  try {
    const feeders = getAllFeeders();
    res.json({ success: true, feeders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/feeders/:id/meters - List meters in topology order with latest reading
apiRouter.get('/feeders/:id/meters', (req: Request, res: Response) => {
  try {
    const feederId = req.params.id;
    const meters = getMetersByFeeder(feederId);
    res.json({ success: true, feeder_id: feederId, meters });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/readings - Ingest single or array of smart meter readings (used by real ESP32 nodes or simulator)
apiRouter.post('/readings', (req: Request, res: Response) => {
  try {
    const body = req.body;

    if (Array.isArray(body)) {
      for (const item of body) {
        if (!item.meter_id || item.voltage === undefined || item.current === undefined) {
          return res.status(400).json({ success: false, error: 'Malformed reading item. Required fields: meter_id, voltage, current.' });
        }
      }
      insertReadingsBatch(body);
    } else {
      const { meter_id, voltage, current, recorded_at } = body;
      if (!meter_id || voltage === undefined || current === undefined) {
        return res.status(400).json({ success: false, error: 'Malformed reading. Required fields: meter_id, voltage, current.' });
      }
      insertReading(meter_id, Number(voltage), Number(current), recorded_at);
    }

    // Default feeder for hackathon single feeder FDR-ALPHA-01
    const feederId = req.query.feeder_id as string || 'FDR-ALPHA-01';

    // Run core algorithm server-side immediately after ingestion
    const detectionResult = runBreakDetection(feederId);

    // Broadcast live telemetry & detection update via WebSocket
    broadcast('DETECTION_RESULT', detectionResult);

    res.json({
      success: true,
      message: 'Reading(s) ingested successfully',
      detectionResult
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/feeders/:id/status - Current fault status for feeder
apiRouter.get('/feeders/:id/status', (req: Request, res: Response) => {
  try {
    const feederId = req.params.id;
    const detectionResult = runBreakDetection(feederId);
    const activeBreak = getActiveBreakEvent(feederId);

    res.json({
      success: true,
      feeder_id: feederId,
      status: detectionResult.status,
      active_break: activeBreak || null,
      detectionResult
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/alerts - Recent alerts
apiRouter.get('/alerts', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const alerts = getAlerts(limit);
    res.json({ success: true, alerts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/:id/acknowledge - Mark alert acknowledged
apiRouter.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  try {
    const alertId = parseInt(req.params.id, 10);
    acknowledgeAlert(alertId);
    
    // Broadcast updated alerts via WS
    const alerts = getAlerts(50);
    broadcast('ALERTS_UPDATE', alerts);

    res.json({ success: true, message: `Alert #${alertId} acknowledged successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// SIMULATOR ENDPOINTS FOR DASHBOARD DEMO CONTROLS

// GET /api/simulator/config
apiRouter.get('/simulator/config', (req: Request, res: Response) => {
  res.json({ success: true, config: getSimulatorConfig() });
});

// POST /api/simulator/break - Inject break downstream of position
apiRouter.post('/simulator/break', (req: Request, res: Response) => {
  try {
    const { position } = req.body;
    if (position === undefined || position < 1 || position > 6) {
      return res.status(400).json({ success: false, error: 'Invalid meter position. Must be between 1 and 6.' });
    }

    const updatedConfig = setSimulatorBreak(Number(position));
    res.json({ success: true, message: `Conductor break injected downstream of Meter Position ${position}`, config: updatedConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/simulator/restore - Restore line to normal
apiRouter.post('/simulator/restore', (req: Request, res: Response) => {
  try {
    const updatedConfig = setSimulatorBreak(null);
    res.json({ success: true, message: 'Feeder line restored to normal healthy status.', config: updatedConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/simulator/toggle - Start/stop simulator auto generation
apiRouter.post('/simulator/toggle', (req: Request, res: Response) => {
  try {
    const { running } = req.body;
    const updatedConfig = toggleSimulator(running);
    res.json({ success: true, config: updatedConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/simulator/staleness - Toggle connection loss simulation
apiRouter.post('/simulator/staleness', (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    const updatedConfig = setSimulatorStaleness(!!enabled);
    res.json({ success: true, config: updatedConfig });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
