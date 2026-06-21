import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

// Express REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Omnigent Server' });
});

export interface EventMessage {
  eventId: string;
  taskId: string;
  timestamp: string;
  sender: string;
  receiver: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  message: string;
  metadata?: any;
}

// In-memory event history (to be migrated to cloud DB in later phases)
export const eventLogs: EventMessage[] = [];

// Helper to broadcast to all connected WebSocket clients
export const broadcast = (wss: WebSocket.Server, data: object, senderSocket?: WebSocket) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== senderSocket) {
      client.send(payload);
    }
  });
};

export const setupWebSocketServer = (server: any): WebSocket.Server => {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request: any, socket: any, head: any) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to Event Bus.');

    // Sync historical log with newly connected React UI or monitoring dashboard
    ws.send(JSON.stringify({
      type: 'SYNC_HISTORY',
      payload: eventLogs
    }));

    ws.on('message', (message: string) => {
      try {
        const parsed = JSON.parse(message);
        
        // Route message if it matches Blackboard event protocol
        if (parsed.type === 'BLACKBOARD_EVENT') {
          const event: EventMessage = parsed.payload;
          console.log(`[Event Bus] ${event.sender} -> ${event.receiver} | Status: ${event.status} | Msg: ${event.message}`);
          
          eventLogs.push(event);
          
          // Broadcast the event to all other subscribers (e.g. React client)
          broadcast(wss, {
            type: 'BLACKBOARD_EVENT',
            payload: event
          }, ws);
        } else {
          console.log('Received raw message:', parsed);
        }
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from Event Bus.');
    });
  });

  return wss;
};

export default app;
