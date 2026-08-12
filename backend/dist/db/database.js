"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.seedDatabase = seedDatabase;
exports.getAllFeeders = getAllFeeders;
exports.getMetersByFeeder = getMetersByFeeder;
exports.insertReading = insertReading;
exports.insertReadingsBatch = insertReadingsBatch;
exports.getActiveBreakEvent = getActiveBreakEvent;
exports.createBreakEvent = createBreakEvent;
exports.resolveBreakEvents = resolveBreakEvents;
exports.getAlerts = getAlerts;
exports.acknowledgeAlert = acknowledgeAlert;
const sql_js_1 = __importDefault(require("sql.js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let db;
const dbPath = path_1.default.resolve(__dirname, '../../feeder_watch.sqlite');
function saveToDisk() {
    if (!db)
        return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs_1.default.writeFileSync(dbPath, buffer);
}
async function initDatabase() {
    const SQL = await (0, sql_js_1.default)();
    if (fs_1.default.existsSync(dbPath)) {
        const fileBuffer = fs_1.default.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);
    }
    else {
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
    const count = res.length > 0 && res[0].values.length > 0 ? res[0].values[0][0] : 0;
    if (count === 0) {
        seedDatabase();
    }
    else {
        saveToDisk();
    }
}
function seedDatabase() {
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
        db.run('INSERT INTO meters (id, feeder_id, branch_id, position_order, household_label) VALUES (?, ?, ?, ?, ?)', [m.id, m.feeder, m.branch, m.pos, m.label]);
    }
    saveToDisk();
    console.log('Database initialized and pre-seeded with Feeder FDR-ALPHA-01 and 6 topology-ordered meters.');
}
// Database query helpers
function getAllFeeders() {
    const stmt = db.prepare('SELECT * FROM feeders ORDER BY created_at ASC');
    const feeders = [];
    while (stmt.step()) {
        feeders.push(stmt.getAsObject());
    }
    stmt.free();
    return feeders;
}
function getMetersByFeeder(feederId) {
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
    const meters = [];
    while (stmt.step()) {
        meters.push(stmt.getAsObject());
    }
    stmt.free();
    return meters;
}
function insertReading(meterId, voltage, current, recordedAt) {
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
function insertReadingsBatch(readings) {
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
function getActiveBreakEvent(feederId) {
    const stmt = db.prepare("SELECT * FROM break_events WHERE feeder_id = ? AND status = 'active' ORDER BY detected_at DESC LIMIT 1");
    stmt.bind([feederId]);
    let activeEvent = null;
    if (stmt.step()) {
        activeEvent = stmt.getAsObject();
    }
    stmt.free();
    return activeEvent;
}
function createBreakEvent(feederId, lastHealthyMeterId, firstDeadMeterId) {
    const timestamp = new Date().toISOString();
    db.run("INSERT INTO break_events (feeder_id, last_healthy_meter_id, first_dead_meter_id, detected_at, status, trip_issued) VALUES (?, ?, ?, ?, 'active', 1)", [feederId, lastHealthyMeterId, firstDeadMeterId]);
    const breakRes = db.exec('SELECT last_insert_rowid() as id');
    const breakEventId = breakRes.length > 0 && breakRes[0].values.length > 0 ? breakRes[0].values[0][0] : 1;
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
function resolveBreakEvents(feederId) {
    const timestamp = new Date().toISOString();
    db.run("UPDATE break_events SET status = 'resolved', resolved_at = ? WHERE feeder_id = ? AND status = 'active'", [
        timestamp,
        feederId
    ]);
    saveToDisk();
}
function getAlerts(limit = 50) {
    const stmt = db.prepare('SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?');
    stmt.bind([limit]);
    const alerts = [];
    while (stmt.step()) {
        alerts.push(stmt.getAsObject());
    }
    stmt.free();
    return alerts;
}
function acknowledgeAlert(alertId) {
    db.run('UPDATE alerts SET acknowledged = 1 WHERE id = ?', [alertId]);
    saveToDisk();
}
