import WebSocket from 'ws';

const EVENT_BUS_URL = 'ws://localhost:3000';
let ws: WebSocket;

function connect() {
  console.log(`[Coder Agent] Connecting to Event Bus at ${EVENT_BUS_URL}...`);
  ws = new WebSocket(EVENT_BUS_URL);

  ws.on('open', () => {
    console.log('[Coder Agent] Connected to Event Bus. Standing by for tasks...');
    
    // Send initial status event to register on the board
    sendEvent('task_init', 'PENDING', 'Coder Agent is online and listening for instructions.');
  });

  ws.on('message', (message: string) => {
    try {
      const parsed = JSON.parse(message);
      
      // Look for tasks assigned to the coder agent
      if (parsed.type === 'NEW_TASK' && parsed.payload.assignedTo === 'coder_agent') {
        runTask(parsed.payload.taskId, parsed.payload.description);
      }
    } catch (err) {
      console.error('[Coder Agent] Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    console.log('[Coder Agent] Disconnected from Event Bus. Reconnecting in 5s...');
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.error('[Coder Agent] WebSocket error:', err.message);
  });
}

async function runTask(taskId: string, description: string) {
  console.log(`[Coder Agent] Received task (${taskId}): ${description}`);
  
  // Step 1: Start task
  sendEvent(taskId, 'IN_PROGRESS', `Analyzing workspace for task: "${description}"`);
  await sleep(2500);

  // Step 2: Write code (simulation)
  sendEvent(taskId, 'IN_PROGRESS', 'Writing new modules and config files...');
  await sleep(3000);

  // Step 3: Lint / Verify (simulation)
  sendEvent(taskId, 'IN_PROGRESS', 'Running linter and verification tests...');
  await sleep(2000);

  // Step 4: Complete
  sendEvent(taskId, 'COMPLETED', `Task completed! Applied changes for: "${description}"`);
}

function sendEvent(taskId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED', message: string) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const eventPayload = {
    type: 'BLACKBOARD_EVENT',
    payload: {
      eventId: 'evt_' + Math.random().toString(36).slice(2, 8),
      taskId,
      timestamp: new Date().toLocaleTimeString(),
      sender: 'coder_agent',
      receiver: 'blackboard',
      status,
      message
    }
  };

  ws.send(JSON.stringify(eventPayload));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start connection
connect();
