"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const API_HOST = process.env.API_HOST || 'localhost';
const API_PORT = process.env.API_PORT || 3001;
// Parse command line arguments
const args = process.argv.slice(2);
let breakPos = null;
const breakArg = args.find((a) => a.startsWith('--break=') || a === '--break');
if (breakArg) {
    if (breakArg.includes('=')) {
        breakPos = parseInt(breakArg.split('=')[1], 10);
    }
    else {
        const nextIdx = args.indexOf('--break') + 1;
        if (args[nextIdx])
            breakPos = parseInt(args[nextIdx], 10);
    }
}
console.log('=====================================================');
console.log('   LT LINE BREAK SIMULATOR - CLI SENSOR EMULATOR     ');
console.log('=====================================================');
console.log(`Target Backend: http://${API_HOST}:${API_PORT}/api/readings`);
if (breakPos) {
    console.log(`[FAULT MODE ACTIVE] Simulating conductor break downstream of Meter Position ${breakPos}`);
}
else {
    console.log(`[NORMAL MODE] Simulating healthy feeder voltages (~230V ± 3V)`);
}
console.log('Press Ctrl+C to stop simulation.\n');
const METER_IDS = ['MTR-01', 'MTR-02', 'MTR-03', 'MTR-04', 'MTR-05', 'MTR-06'];
function sendTelemetry() {
    const timestamp = new Date().toISOString();
    METER_IDS.forEach((meterId, index) => {
        const pos = index + 1;
        const isBroken = breakPos !== null && pos >= breakPos;
        const voltage = isBroken ? Number((Math.random() * 4.0).toFixed(2)) : Number((230 + (Math.random() * 6 - 3)).toFixed(2));
        const current = isBroken ? Number((Math.random() * 0.1).toFixed(2)) : Number((5.0 + (Math.random() * 1.5 - 0.75)).toFixed(2));
        const payload = JSON.stringify({
            meter_id: meterId,
            voltage,
            current,
            recorded_at: timestamp
        });
        const req = http_1.default.request({
            hostname: API_HOST,
            port: API_PORT,
            path: '/api/readings',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            // Silent response check
        });
        req.on('error', (err) => {
            console.error(`[CLI Simulator] Failed to POST reading for ${meterId}:`, err.message);
        });
        req.write(payload);
        req.end();
    });
    console.log(`[${new Date().toLocaleTimeString()}] Emulated 6 smart meter POST requests to /api/readings`);
}
// Tick every 1.5 seconds
setInterval(sendTelemetry, 1500);
sendTelemetry();
