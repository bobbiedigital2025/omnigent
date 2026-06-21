import express from 'express';
import http from 'http';
import WebSocket from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Express REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Bobbie Digital Hub Server' });
});

// Setup HTTP Server & WebSocket Event Bus
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

interface EventMessage {
  eventId: string;
  taskId: string;
  timestamp: string;
  sender: string;
  receiver: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  message: string;
  metadata?: any;
}

// In-memory event history (will migrate to DB in subsequent stages)
const eventLogs: EventMessage[] = [];

// Helper to broadcast to all connected WebSocket clients (React UI + background agents)
const broadcast = (data: object, senderSocket?: WebSocket) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== senderSocket) {
      client.send(payload);
    }
  });
};

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
        broadcast({
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

// Start Server
server.listen(port, () => {
  console.log(`=================================================`);
  console.log(`🚀 Bobbie Digital Hub Server is running on port ${port}`);
  console.log(`📡 WebSocket Event Bus is listening...`);
  console.log(`=================================================`);
});
