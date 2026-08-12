import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

let db: Database;
const dbPath = path.resolve(__dirname, '../../feeder_watch.sqlite');

function saveToDisk() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Create database schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS feeders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      transformer_label TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meters (
      id TEXT PRIMARY KEY,
      feeder_id TEXT NOT NULL,
      branch_id TEXT DEFAULT 'main',
      position_order INTEGER NOT NULL,
      household_label TEXT NOT NULL,
      installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meter_id TEXT NOT NULL,
      voltage REAL NOT NULL,
      current REAL NOT NULL,
      recorded_at DATETIME NOT NULL
    );

    CREATE TABLE IF NOT EXISTS break_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feeder_id TEXT NOT NULL,
      last_healthy_meter_id TEXT NOT NULL,
      first_dead_meter_id TEXT NOT NULL,
      detected_at DATETIME NOT NULL,
      resolved_at DATETIME,
      status TEXT NOT NULL CHECK(status IN ('active', 'resolved')),
      trip_issued INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      break_event_id INTEGER,
      message TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'CRITICAL',
      created_at DATETIME NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Seed default Feeder & 6 Meters if feeders table is empty
  const res = db.exec('SELECT COUNT(*) as count FROM feeders');
  const count = res.length > 0 && res[0].values.length > 0 ? (res[0].values[0][0] as number) : 0;

  if (count === 0) {
    seedDatabase();
  } else {
    saveToDisk();
  }
}

export function seedDatabase() {
  db.run(`
    INSERT INTO feeders (id, name, transformer_label)
    VALUES ('FDR-ALPHA-01', 'Feeder Alpha-01 (Sector 4 Substation)', 'TR-101 (11kV/415V 250kVA Transformer)');
  `);

  const meters = [
    { id: 'MTR-01', feeder: 'FDR-ALPHA-01', branch: 'main', pos: 1, label: 'Substation Gate - Commercial Block A' },
    { id: 'MTR-02', feeder: 'FDR-ALPHA-01', branch: 'main', pos: 2, label: 'Sector 4 North - House #12 to #24' },
    { id: 'MTR-03', feeder: 'FDR-ALPHA-01', branch: 'main', pos: 3, label: 'Market Complex & Public Lighting' },
    { id: 'MTR-04', feeder: 'FDR-ALPHA-01', branch: 'main', pos: 4, label: 'Residential Block A - House #45 to #60' },
    { id: 'MTR-05', feeder: 'FDR-ALPHA-01', branch: 'main', pos: 5, label: 'School Junction & Community Hall' },
    { id: 'MTR-06', feeder: 'FDR-ALPHA-01', branch: 'main', pos: 6, label: 'Terminal Station - End of Feeder Line' },
  ];

  for (const m of meters) {
    db.run(
      'INSERT INTO meters (id, feeder_id, branch_id, position_order, household_label) VALUES (?, ?, ?, ?, ?)',
      [m.id, m.feeder, m.branch, m.pos, m.label]
    );
  }

  saveToDisk();
  console.log('Database initialized and pre-seeded with Feeder FDR-ALPHA-01 and 6 topology-ordered meters.');
}

// Database query helpers
export function getAllFeeders() {
  const stmt = db.prepare('SELECT * FROM feeders ORDER BY created_at ASC');
  const feeders: any[] = [];
  while (stmt.step()) {
    feeders.push(stmt.getAsObject());
  }
  stmt.free();
  return feeders;
}

export function getMetersByFeeder(feederId: string) {
  const query = `
    SELECT m.*, 
           r.voltage as latest_voltage, 
           r.current as latest_current, 
           r.recorded_at as latest_recorded_at
    FROM meters m
    LEFT JOIN (
      SELECT r1.*
      FROM readings r1
      INNER JOIN (
        SELECT meter_id, MAX(id) as max_id
        FROM readings
        GROUP BY meter_id
      ) r2 ON r1.id = r2.max_id
    ) r ON m.id = r.meter_id
    WHERE m.feeder_id = ?
    ORDER BY m.position_order ASC
  `;

  const stmt = db.prepare(query);
  stmt.bind([feederId]);
  const meters: any[] = [];
  while (stmt.step()) {
    meters.push(stmt.getAsObject());
  }
  stmt.free();
  return meters;
}

export function insertReading(meterId: string, voltage: number, current: number, recordedAt?: string) {
  const timestamp = recordedAt || new Date().toISOString();
  db.run('INSERT INTO readings (meter_id, voltage, current, recorded_at) VALUES (?, ?, ?, ?)', [
    meterId,
    voltage,
    current,
    timestamp
  ]);
  saveToDisk();
  return { meter_id: meterId, voltage, current, recorded_at: timestamp };
}

export function insertReadingsBatch(readings: Array<{ meter_id: string; voltage: number; current: number; recorded_at?: string }>) {
  for (const item of readings) {
    const timestamp = item.recorded_at || new Date().toISOString();
    db.run('INSERT INTO readings (meter_id, voltage, current, recorded_at) VALUES (?, ?, ?, ?)', [
      item.meter_id,
      item.voltage,
      item.current,
      timestamp
    ]);
  }
  saveToDisk();
}

export function getActiveBreakEvent(feederId: string) {
  const stmt = db.prepare("SELECT * FROM break_events WHERE feeder_id = ? AND status = 'active' ORDER BY detected_at DESC LIMIT 1");
  stmt.bind([feederId]);
  let activeEvent: any = null;
  if (stmt.step()) {
    activeEvent = stmt.getAsObject();
  }
  stmt.free();
  return activeEvent;
}

export function createBreakEvent(feederId: string, lastHealthyMeterId: string, firstDeadMeterId: string) {
  const timestamp = new Date().toISOString();
  db.run(
    "INSERT INTO break_events (feeder_id, last_healthy_meter_id, first_dead_meter_id, detected_at, status, trip_issued) VALUES (?, ?, ?, ?, 'active', 1)",
    [feederId, lastHealthyMeterId, firstDeadMeterId, timestamp]
  );

  const breakRes = db.exec('SELECT last_insert_rowid() as id');
  const breakEventId = breakRes.length > 0 && breakRes[0].values.length > 0 ? (breakRes[0].values[0][0] as number) : 1;

  const alertMessage = `CRITICAL FAULT DETECTED: LT Line Conductor Snap on Feeder ${feederId} between Meter ${lastHealthyMeterId} and Meter ${firstDeadMeterId}. Isolating downstream segment immediately.`;
  db.run('INSERT INTO alerts (break_event_id, message, severity, created_at, acknowledged) VALUES (?, ?, ?, ?, 0)', [
    breakEventId,
    alertMessage,
    'CRITICAL',
    timestamp
  ]);

  saveToDisk();
  return { id: breakEventId, feeder_id: feederId, last_healthy_meter_id: lastHealthyMeterId, first_dead_meter_id: firstDeadMeterId, detected_at: timestamp, status: 'active', trip_issued: 1 };
}

export function resolveBreakEvents(feederId: string) {
  const timestamp = new Date().toISOString();
  db.run("UPDATE break_events SET status = 'resolved', resolved_at = ? WHERE feeder_id = ? AND status = 'active'", [
    timestamp,
    feederId
  ]);
  saveToDisk();
}

export function getAlerts(limit = 50) {
  const stmt = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?');
  stmt.bind([limit]);
  const alerts: any[] = [];
  while (stmt.step()) {
    alerts.push(stmt.getAsObject());
  }
  stmt.free();
  return alerts;
}

export function acknowledgeAlert(alertId: number) {
  db.run('UPDATE alerts SET acknowledged = 1 WHERE id = ?', [alertId]);
  saveToDisk();
}
