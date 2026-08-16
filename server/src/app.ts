import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';
import { McpClientManager } from './mcp/mcpClient';

import { globalSandboxManager } from './sandboxes/sandboxManager';

const app = express();

app.use(cors());
app.use(express.json());

export const mcpManager = new McpClientManager();
mcpManager.initializeAll().then(() => {
  console.log('[System] MCP Client Manager initialized.');
});

// Express REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Omnigent Server' });
});

app.get('/api/mcp/tools', async (req, res) => {
  try {
    const tools = await mcpManager.listAllTools();
    res.json({ tools });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mcp/call', async (req, res) => {
  const { serverName, toolName, arguments: toolArgs } = req.body;
  try {
    const result = await mcpManager.callTool(serverName, toolName, toolArgs);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agent Sandbox API Endpoints
app.get('/api/sandboxes', (req, res) => {
  const active = globalSandboxManager.listActiveSandboxes();
  res.json({ sandboxes: active });
});

app.post('/api/sandboxes/:agentId/exec', async (req, res) => {
  const { agentId } = req.params;
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }
  try {
    const result = await globalSandboxManager.runCommand(agentId, command);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sandboxes/:agentId', async (req, res) => {
  const { agentId } = req.params;
  try {
    await globalSandboxManager.destroySandbox(agentId);
    res.json({ status: 'DELETED', agentId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Cinema Studio Telemetry API Endpoints
import { globalStudioMetrics } from './telemetry/studioMetricsEmitter';
globalStudioMetrics.startEmitting(3000);

app.get('/api/cinema/telemetry', (req, res) => {
  res.json({ telemetry: globalStudioMetrics.getSnapshot() });
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
        
        if (parsed.type === 'BLACKBOARD_EVENT') {
          const event: EventMessage = parsed.payload;
          console.log(`[Event Bus] ${event.sender} -> ${event.receiver} | Status: ${event.status} | Msg: ${event.message}`);
          eventLogs.push(event);
        } else {
          console.log(`[Event Bus] Routing event type: ${parsed.type}`);
        }
        
        // Broadcast all incoming messages to other connected clients
        broadcast(wss, parsed, ws);
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
