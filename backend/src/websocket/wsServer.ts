import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export let wss: WebSocketServer;

export function initWebSocketServer(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (ws: WebSocket) => {
    console.log('[WebSocket] SCADA Client connected to /ws/live');

    ws.send(
      JSON.stringify({
        type: 'CONNECTED',
        message: 'Connected to Feeder Watch SCADA Real-Time Data Stream',
        timestamp: new Date().toISOString()
      })
    );

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message.toString());
        if (payload.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        }
      } catch (err) {
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

export function broadcast(type: string, data: any) {
  if (!wss) return;

  const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}
