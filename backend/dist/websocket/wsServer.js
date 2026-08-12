"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wss = void 0;
exports.initWebSocketServer = initWebSocketServer;
exports.broadcast = broadcast;
const ws_1 = require("ws");
function initWebSocketServer(server) {
    exports.wss = new ws_1.WebSocketServer({ server, path: '/ws/live' });
    exports.wss.on('connection', (ws) => {
        console.log('[WebSocket] SCADA Client connected to /ws/live');
        ws.send(JSON.stringify({
            type: 'CONNECTED',
            message: 'Connected to Feeder Watch SCADA Real-Time Data Stream',
            timestamp: new Date().toISOString()
        }));
        ws.on('message', (message) => {
            try {
                const payload = JSON.parse(message.toString());
                if (payload.type === 'PING') {
                    ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
                }
            }
            catch (err) {
                console.error('[WebSocket] Error parsing message:', err);
            }
        });
        ws.on('close', () => {
            console.log('[WebSocket] SCADA Client disconnected');
        });
        ws.on('error', (err) => {
            console.error('[WebSocket] Socket error:', err.message);
        });
    });
    console.log('[WebSocket] Server ready on path /ws/live');
}
function broadcast(type, data) {
    if (!exports.wss)
        return;
    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    exports.wss.clients.forEach((client) => {
        if (client.readyState === ws_1.WebSocket.OPEN) {
            client.send(payload);
        }
    });
}
