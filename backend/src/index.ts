import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { initDatabase } from './db/database';
import { initWebSocketServer } from './websocket/wsServer';
import { apiRouter } from './routes/api';
import { startSimulator } from './simulator/simulatorService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Feeder Watch Backend API', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = http.createServer(app);

async function startServer() {
  // Initialize Database (Async WebAssembly SQLite)
  await initDatabase();

  // Initialize WebSocket server
  initWebSocketServer(server);

  // Start background telemetry simulator
  startSimulator();

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
