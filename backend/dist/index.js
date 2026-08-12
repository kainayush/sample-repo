"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./db/database");
const wsServer_1 = require("./websocket/wsServer");
const api_1 = require("./routes/api");
const simulatorService_1 = require("./simulator/simulatorService");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api', api_1.apiRouter);
// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'Feeder Watch Backend API', timestamp: new Date().toISOString() });
});
// Create HTTP server
const server = http_1.default.createServer(app);
async function startServer() {
    // Initialize Database (Async WebAssembly SQLite)
    await (0, database_1.initDatabase)();
    // Initialize WebSocket server
    (0, wsServer_1.initWebSocketServer)(server);
    // Start background telemetry simulator
    (0, simulatorService_1.startSimulator)();
    // Start HTTP Server
    server.listen(PORT, () => {
        console.log('=====================================================');
        console.log(`  FEEDER WATCH BACKEND SERVICE RUNNING ON PORT ${PORT}  `);
        console.log(`  REST API:      http://localhost:${PORT}/api        `);
        console.log(`  WebSocket:     ws://localhost:${PORT}/ws/live      `);
        console.log('=====================================================');
    });
}
startServer().catch((err) => {
    console.error('Failed to start backend server:', err);
});
