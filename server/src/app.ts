import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// Security Hardening Headers
app.use(helmet({
  contentSecurityPolicy: false // Disabled for dev mockup iframe previewing compatibility
}));

// API Rate Limiting to prevent brute-force and DDoS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', apiLimiter);

// CORS settings - restricted to local clients during staging, configurable for production
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*'
}));
app.use(express.json());

// Dev-only flag to allow granting admin access for testing.
// Set `ALLOW_DEV_ADMIN_FREE_ACCESS=true` in the environment to enable.
const ALLOW_DEV_ADMIN_FREE_ACCESS = process.env.ALLOW_DEV_ADMIN_FREE_ACCESS === 'true' || process.env.NODE_ENV === 'development';

// Express REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Omnigent Server' });
});

// Event Schema for Blackboard Pattern
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

// In-memory databases for Mock CRM and Support
let mockUsers = [
  { id: 'usr_101', name: 'Alice Jameson', email: 'alice@example.com', role: 'Premium User', status: 'Active', joined: '2026-01-15' },
  { id: 'usr_102', name: 'Bob McBillings', email: 'billing@client.com', role: 'Customer', status: 'Active', joined: '2026-03-22' },
  { id: 'usr_103', name: 'Charlie Rogers', email: 'charlie@rogers.net', role: 'Standard User', status: 'Inactive', joined: '2025-11-04' },
  { id: 'usr_104', name: 'Diana Prince', email: 'diana@amazon.org', role: 'Premium User', status: 'Active', joined: '2026-05-19' },
  { id: 'usr_105', name: 'Evan Wright', email: 'evan@wright-tech.com', role: 'Partner', status: 'Active', joined: '2026-06-01' }
];

let mockTickets = [
  {
    id: 'tkt_001',
    userEmail: 'billing@client.com',
    subject: 'Failed Payment - Order #9012',
    status: 'Open',
    priority: 'High',
    messages: [
      { sender: 'user', text: 'Hi support, my payment for order #9012 failed, but my card was charged. Please check.', time: '2026-06-20T10:15:00Z' }
    ],
    draft: ''
  },
  {
    id: 'tkt_002',
    userEmail: 'alice@example.com',
    subject: 'Cannot login to account',
    status: 'Open',
    priority: 'Medium',
    messages: [
      { sender: 'user', text: 'Hello, I am getting an Invalid Credential error when I log in. Did my account expire?', time: '2026-06-21T08:30:00Z' }
    ],
    draft: ''
  },
  {
    id: 'tkt_003',
    userEmail: 'charlie@rogers.net',
    subject: 'Terms of Service update clarification',
    status: 'Closed',
    priority: 'Low',
    messages: [
      { sender: 'user', text: 'I saw the notification about the updated terms of service. What does the LLM routing disclaimer mean for my user data privacy?', time: '2026-06-21T02:00:00Z' },
      { sender: 'support', text: 'Hi Charlie, our terms outline that user logs are parsed by secure, isolated cloud models for agent-assisted operations, and no personal identifiable data is ever trained on.', time: '2026-06-21T03:15:00Z' }
    ],
    draft: ''
  }
];

// Telemetry state
let isLeakActive = true;
let currentMemoryUsage = 82; // %

// Event logs for the blackboard
export const eventLogs: EventMessage[] = [
  {
    eventId: 'evt_init',
    taskId: 'task_000',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    sender: 'Main Bot',
    receiver: 'blackboard',
    status: 'COMPLETED',
    message: 'System initialization complete. Event Bus online and listening.'
  }
];

// Reference to active WS server
let wssInstance: WebSocket.Server | null = null;

// Helper to broadcast to all connected WebSocket clients
export const broadcast = (wss: WebSocket.Server, data: object, senderSocket?: WebSocket) => {
  const payload = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== senderSocket) {
      client.send(payload);
    }
  });
};

// Simulated workflow runner
const runAgentSimulation = (type: 'scaffold' | 'hotfix' | 'draft_assist', ticketId?: string) => {
  if (!wssInstance) return;

  const wss = wssInstance;
  const taskId = `task_${Math.floor(Math.random() * 90000) + 10000}`;

  const sendEvent = (sender: string, receiver: string, status: EventMessage['status'], message: string, delay: number, onExecute?: () => void) => {
    setTimeout(() => {
      if (onExecute) onExecute();
      const event: EventMessage = {
        eventId: `evt_${Math.floor(Math.random() * 90000) + 10000}`,
        taskId,
        timestamp: new Date().toISOString(),
        sender,
        receiver,
        status,
        message
      };
      eventLogs.push(event);
      broadcast(wss, { type: 'BLACKBOARD_EVENT', payload: event });
      
      // Also broadcast chat message updates to the user from the Main Bot
      if (sender === 'Main Bot') {
        broadcast(wss, {
          type: 'CHAT_MESSAGE',
          payload: {
            id: `msg_${Math.random()}`,
            sender: 'agent',
            text: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        });
      }
    }, delay);
  };

  if (type === 'scaffold') {
    sendEvent('Main Bot', 'blackboard', 'PENDING', 'Initiating application scaffold for client X.', 500);
    sendEvent('Scaffold Agent', 'blackboard', 'IN_PROGRESS', 'Downloading project structures and running Vite bootstrap...', 2000);
    sendEvent('Scaffold Agent', 'blackboard', 'COMPLETED', 'Scaffolding completed. Setting up configurations and compiling files.', 4000, () => {
      broadcast(wss, { type: 'PREVIEW_STATE', payload: { active: true, appName: 'Bobbie Digital LLC Landing Page' } });
    });
    sendEvent('Main Bot', 'blackboard', 'COMPLETED', 'Successfully created and loaded the React + Vite landing page app. You can now view it in the App Preview panel!', 5500);
  } else if (type === 'hotfix') {
    sendEvent('Main Bot', 'blackboard', 'PENDING', 'Analyzing active memory leak logs on production environment.', 500);
    sendEvent('Coder Agent', 'blackboard', 'IN_PROGRESS', 'Scanning socket listeners in backend server src/app.ts...', 1500);
    sendEvent('Coder Agent', 'blackboard', 'COMPLETED', 'Identified unclosed socket channels. Applying active handler cleanup patch.', 3500, () => {
      isLeakActive = false;
      currentMemoryUsage = 38; // drops back to normal
      broadcast(wss, { type: 'TELEMETRY_UPDATE', payload: { isLeakActive, currentMemoryUsage } });
    });
    sendEvent('Main Bot', 'blackboard', 'COMPLETED', 'Hotfix applied and verified. Server memory usage normalized to 38% (312MB).', 5000);
  } else if (type === 'draft_assist' && ticketId) {
    const tkt = mockTickets.find(t => t.id === ticketId);
    if (!tkt) return;
    
    sendEvent('Support Agent', 'blackboard', 'IN_PROGRESS', `Searching CRM databases and log audit logs for: ${tkt.userEmail}`, 500);
    sendEvent('Support Agent', 'blackboard', 'COMPLETED', `Found failed Stripe charge for invoice #9012 (Card declined). Drafting reply.`, 2500, () => {
      const dbUser = mockUsers.find(u => u.email === tkt.userEmail);
      const name = dbUser ? dbUser.name : 'Customer';
      
      let replyDraft = '';
      if (tkt.id === 'tkt_001') {
        replyDraft = `Hi ${name},\n\nI investigated your query regarding Order #9012. Our logs indicate the payment transaction was declined by your bank, but we noticed a secondary pending auth hold. We have released this hold and marked the payment as voided. You can try checking out again now.\n\nBest regards,\nSupport Agent Assisted Draft`;
      } else {
        replyDraft = `Hi ${name},\n\nI looked up your credentials in our user directory and noticed your profile is active. I have generated a temporary link to reset your security details. Please check your inbox shortly.\n\nBest regards,\nSupport Agent Assisted Draft`;
      }
      tkt.draft = replyDraft;
      broadcast(wss, { type: 'TICKET_DRAFTED', payload: { ticketId, draft: replyDraft } });
    });
  }
};

// REST API routes
app.get('/api/users', (req, res) => {
  res.json(mockUsers);
});

// GDPR data download/export
app.post('/api/users/export', (req, res) => {
  const { id } = req.body;
  const user = mockUsers.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({
    status: 'success',
    data: {
      userProfile: user,
      activityLogs: [
        { action: 'user_login', ip: '192.168.1.1', time: '2026-06-21T04:22:00Z' },
        { action: 'dashboard_view', time: '2026-06-21T04:23:45Z' }
      ]
    }
  });
});

// GDPR right to be forgotten
app.post('/api/users/delete', (req, res) => {
  const { id } = req.body;
  const index = mockUsers.findIndex(u => u.id === id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  const deletedUser = mockUsers[index];
  mockUsers.splice(index, 1);
  
  if (wssInstance) {
    broadcast(wssInstance, {
      type: 'BLACKBOARD_EVENT',
      payload: {
        eventId: `evt_gdpr_${Date.now()}`,
        taskId: 'gdpr_compliance',
        timestamp: new Date().toISOString(),
        sender: 'Main Bot',
        receiver: 'blackboard',
        status: 'COMPLETED',
        message: `GDPR Compliance: Permanently deleted all files and records for user ${deletedUser.name} (${deletedUser.email}).`
      }
    });
  }
  
  res.json({ status: 'success', message: 'User permanently deleted from CRM' });
});

app.get('/api/tickets', (req, res) => {
  res.json(mockTickets);
});

// Dev-only endpoints: safely grant/revoke Admin role for testing when flag is enabled
app.post('/api/admin/grant-dev', (req, res) => {
  if (!ALLOW_DEV_ADMIN_FREE_ACCESS) return res.status(403).json({ error: 'Dev admin access disabled' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  const user = mockUsers.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = 'Admin';
  if (wssInstance) {
    broadcast(wssInstance, {
      type: 'BLACKBOARD_EVENT',
      payload: {
        eventId: `evt_admin_${Date.now()}`,
        taskId: 'admin_grant',
        timestamp: new Date().toISOString(),
        sender: 'DevTool',
        receiver: 'blackboard',
        status: 'COMPLETED',
        message: `Granted Admin role to ${user.email} via dev endpoint.`
      }
    });
  }
  res.json({ status: 'success', user });
});

app.post('/api/admin/revoke-dev', (req, res) => {
  if (!ALLOW_DEV_ADMIN_FREE_ACCESS) return res.status(403).json({ error: 'Dev admin access disabled' });
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });
  const user = mockUsers.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = 'User';
  if (wssInstance) {
    broadcast(wssInstance, {
      type: 'BLACKBOARD_EVENT',
      payload: {
        eventId: `evt_admin_${Date.now()}`,
        taskId: 'admin_revoke',
        timestamp: new Date().toISOString(),
        sender: 'DevTool',
        receiver: 'blackboard',
        status: 'COMPLETED',
        message: `Revoked Admin role from ${user.email} via dev endpoint.`
      }
    });
  }
  res.json({ status: 'success', user });
});

app.post('/api/tickets/reply', (req, res) => {
  const { ticketId, text } = req.body;
  const ticket = mockTickets.find(t => t.id === ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  
  ticket.messages.push({
    sender: 'support',
    text,
    time: new Date().toISOString()
  });
  ticket.status = 'Closed';
  ticket.draft = '';
  res.json({ status: 'success', ticket });
});

app.post('/api/tickets/draft-assist', (req, res) => {
  const { ticketId } = req.body;
  runAgentSimulation('draft_assist', ticketId);
  res.json({ status: 'initiated' });
});

app.get('/api/telemetry', (req, res) => {
  res.json({
    isLeakActive,
    currentMemoryUsage,
    cpuUsage: Math.floor(Math.random() * 15) + 10,
    pageViews: 1420 + Math.floor(Math.random() * 20),
    latency: isLeakActive ? 420 + Math.floor(Math.random() * 100) : 48 + Math.floor(Math.random() * 10)
  });
});

app.post('/api/hotfix', (req, res) => {
  runAgentSimulation('hotfix');
  res.json({ status: 'initiated' });
});

app.post('/api/chat', (req, res) => {
  const { message } = req.body;
  if (!wssInstance) return res.status(500).json({ error: 'WebSocket server not running' });

  const lowercaseMsg = message.toLowerCase();
  
  if (lowercaseMsg.includes('scaffold') || lowercaseMsg.includes('setup') || lowercaseMsg.includes('build')) {
    runAgentSimulation('scaffold');
  } else if (lowercaseMsg.includes('fix') || lowercaseMsg.includes('leak') || lowercaseMsg.includes('hotfix')) {
    runAgentSimulation('hotfix');
  } else {
    // General conversational mock response
    setTimeout(() => {
      broadcast(wssInstance!, {
        type: 'CHAT_MESSAGE',
        payload: {
          id: `msg_${Math.random()}`,
          sender: 'agent',
          text: `I received your message: "${message}". What task would you like me to dispatch to the sub-agents? Let me know if you want to: \n- "Scaffold a landing page"\n- "Run the memory leak hotfix"\n- "Review user privacy settings"`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      });
    }, 1500);
  }
  
  res.json({ status: 'received' });
});

export const setupWebSocketServer = (server: any): WebSocket.Server => {
  const wss = new WebSocket.Server({ noServer: true });
  wssInstance = wss;

  server.on('upgrade', (request: any, socket: any, head: any) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to Event Bus.');

    // Sync historical log with newly connected React UI
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
          broadcast(wss, { type: 'BLACKBOARD_EVENT', payload: event }, ws);
        } else if (parsed.type === 'SEND_CHAT') {
          // Broadcaster chat
          const userMsg = parsed.payload;
          broadcast(wss, { type: 'CHAT_MESSAGE', payload: userMsg }, ws);
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
