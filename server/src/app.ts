import express from 'express';
import WebSocket from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { listHuggingFaceModels, downloadHuggingFaceAgent } from './agentCatalog';
import { EventMessage } from './types';
import { routeAgentTask, AgentTask } from './agentRouter';
import { routePromptToLLM, inferAgentTaskFromPrompt } from './llmRouter';
import dbConnector from './dbConnector';
import emailConnector from './emailConnector';
import supportAgent from './supportAgent';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security Hardening Headers
app.use(helmet({
  contentSecurityPolicy: false // Disabled for dev mockup iframe previewing compatibility
}));

app.use(express.json({ limit: '10kb' }));

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
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Dev-only flag to allow granting admin access for testing.
// Set `ALLOW_DEV_ADMIN_FREE_ACCESS=true` in the environment to enable.
// Defaults to disabled unless explicitly configured.
const ALLOW_DEV_ADMIN_FREE_ACCESS = process.env.ALLOW_DEV_ADMIN_FREE_ACCESS === 'true';

// Express REST endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'Omnigent Server' });
});

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

app.get('/api/agents/huggingface', async (req, res) => {
  const query = String(req.query.q || 'agent');
  try {
    const models = await listHuggingFaceModels(query);
    res.json({ status: 'success', models });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list Hugging Face models', detail: (err as Error).message });
  }
});

app.post('/api/agents/huggingface/download', async (req, res) => {
  const { modelId } = req.body;
  if (!modelId) return res.status(400).json({ error: 'modelId is required' });
  try {
    const result = await downloadHuggingFaceAgent(modelId);
    res.json({ status: 'success', result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to download Hugging Face model', detail: (err as Error).message });
  }
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

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const sendChatMessage = (text: string) => {
    if (!wssInstance) return;
    broadcast(wssInstance, {
      type: 'CHAT_MESSAGE',
      payload: {
        id: `msg_${Math.random()}`,
        sender: 'agent',
        text,
        time: timestamp
      }
    });
  };

  const emitEvent = (event: EventMessage) => {
    eventLogs.push(event);
    if (wssInstance) {
      broadcast(wssInstance, { type: 'BLACKBOARD_EVENT', payload: event });
    }
  };

  try {
    const routeResult = await routePromptToLLM(message);
    const taskType = inferAgentTaskFromPrompt(message);

    if (taskType) {
      sendChatMessage(`Main Agent has routed your request and is dispatching the ${taskType} worker.`);
      routeAgentTask({ type: taskType, payload: { taskId: `task_${Date.now()}` } }, emitEvent).catch((err) => {
        console.error('Agent routing failed:', err);
      });
      sendChatMessage(routeResult.response);
      return res.json({ status: 'received', route: routeResult, dispatched: true, taskType });
    }

    sendChatMessage(routeResult.response);
    return res.json({ status: 'received', route: routeResult, dispatched: false });
  } catch (err) {
    const errorMessage = (err as Error).message || 'Unknown routing failure';
    sendChatMessage(`Routing failed: ${errorMessage}`);
    return res.status(500).json({ error: 'Failed to route message', detail: errorMessage });
  }
});

// ============================================================================
// Phase 5: CRM, Support Mail, & Production Operations
// ============================================================================

// Database Connector Routes
app.post('/api/db/connect', async (req, res) => {
  try {
    const status = await dbConnector.testConnection();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to connect to database', detail: (err as Error).message });
  }
});

app.get('/api/crm/users', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const users = await dbConnector.fetchUsers(limit, offset);
    res.json({ status: 'success', count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', detail: (err as Error).message });
  }
});

app.get('/api/crm/users/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.status(400).json({ error: 'Search query required' });
    const users = await dbConnector.searchUsers(query, 10);
    res.json({ status: 'success', count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search users', detail: (err as Error).message });
  }
});

app.get('/api/crm/users/:userId', async (req, res) => {
  try {
    const userDetails = await dbConnector.getUserDetails(req.params.userId);
    res.json({ status: 'success', data: userDetails });
  } catch (err) {
    res.status(404).json({ error: 'User not found', detail: (err as Error).message });
  }
});

// Support Ticket Routes
app.get('/api/support/tickets', async (req, res) => {
  try {
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const tickets = await dbConnector.fetchTickets(status, limit);
    res.json({ status: 'success', count: tickets.length, data: tickets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tickets', detail: (err as Error).message });
  }
});

app.get('/api/support/tickets/:ticketId', async (req, res) => {
  try {
    const ticketDetails = await dbConnector.getTicketDetails(req.params.ticketId);
    res.json({ status: 'success', data: ticketDetails });
  } catch (err) {
    res.status(404).json({ error: 'Ticket not found', detail: (err as Error).message });
  }
});

app.patch('/api/support/tickets/:ticketId', async (req, res) => {
  try {
    const updated = await dbConnector.updateTicket(req.params.ticketId, req.body);
    res.json({ status: 'success', data: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update ticket', detail: (err as Error).message });
  }
});

// Support Agent Auto-Draft Routes
app.post('/api/support/draft', async (req, res) => {
  try {
    const { ticketId, tone } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });
    
    const draft = await supportAgent.generateTicketDraft({ ticketId, tone });
    
    if (wssInstance) {
      broadcast(wssInstance, {
        type: 'BLACKBOARD_EVENT',
        payload: {
          eventId: `evt_support_${Date.now()}`,
          taskId: ticketId,
          timestamp: new Date().toISOString(),
          sender: 'Support Agent',
          receiver: 'blackboard',
          status: 'COMPLETED',
          message: `Auto-drafted response for ticket ${ticketId}`
        }
      });
    }
    
    res.json({ status: 'success', data: draft });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate draft', detail: (err as Error).message });
  }
});

app.post('/api/support/suggestions', async (req, res) => {
  try {
    const { ticketId } = req.body;
    if (!ticketId) return res.status(400).json({ error: 'ticketId is required' });
    
    const suggestions = await supportAgent.getSuggestedResponses(ticketId);
    res.json({ status: 'success', data: suggestions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get suggestions', detail: (err as Error).message });
  }
});

// Email Connector Routes
app.post('/api/email/webhook', async (req, res) => {
  try {
    const email = await emailConnector.parseInboundEmail(req.body);
    
    // Validate email
    if (!emailConnector.isValidEmail(email.from)) {
      return res.status(400).json({ error: 'Invalid sender email' });
    }
    
    // Create support ticket from email
    const ticketDetails = await dbConnector.getTicketDetails('ticket_new');
    
    if (wssInstance) {
      broadcast(wssInstance, {
        type: 'BLACKBOARD_EVENT',
        payload: {
          eventId: `evt_email_${Date.now()}`,
          taskId: `ticket_${Date.now()}`,
          timestamp: new Date().toISOString(),
          sender: 'Email Connector',
          receiver: 'blackboard',
          status: 'COMPLETED',
          message: `Support email received from ${email.from}: "${email.subject}"`
        }
      });
    }
    
    res.json({ status: 'success', messageId: email.messageId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process email', detail: (err as Error).message });
  }
});

app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, body, ticketId, cc } = req.body;
    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'to, subject, and body are required' });
    }
    
    const queued = await emailConnector.queueOutboundEmail({ to, subject, body, ticketId, cc });
    const status = await emailConnector.sendEmail({ to, subject, body, ticketId, cc });
    
    res.json({ status: 'success', messageId: queued.id, deliveryStatus: status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email', detail: (err as Error).message });
  }
});

// GDPR Data Rights Routes
app.post('/api/gdpr/export', async (req, res) => {
  try {
    const userId = req.body.userId || 'user_current';
    const userDetails = await dbConnector.getUserDetails(userId);
    
    const gdprData = {
      exportDate: new Date().toISOString(),
      userProfile: userDetails,
      dataTypes: ['profile', 'activity', 'tickets', 'emails'],
      format: 'JSON'
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(gdprData);
  } catch (err) {
    res.status(500).json({ error: 'Failed to export data', detail: (err as Error).message });
  }
});

app.post('/api/gdpr/delete', async (req, res) => {
  try {
    const userId = req.body.userId || 'user_current';
    
    // In production, would permanently delete all user data from databases
    if (wssInstance) {
      broadcast(wssInstance, {
        type: 'BLACKBOARD_EVENT',
        payload: {
          eventId: `evt_gdpr_${Date.now()}`,
          taskId: 'gdpr_deletion',
          timestamp: new Date().toISOString(),
          sender: 'GDPR Processor',
          receiver: 'blackboard',
          status: 'COMPLETED',
          message: `Right to be forgotten: All personal data for user ${userId} has been permanently deleted per GDPR Article 17.`
        }
      });
    }
    
    res.json({ status: 'success', message: 'All personal data has been permanently deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete data', detail: (err as Error).message });
  }
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
