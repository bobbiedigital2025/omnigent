import WebSocket from 'ws';
import { globalSandboxManager } from '../sandboxes/sandboxManager';

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'ws://localhost:3000';
const AGENT_ID = 'sandboxedTesterAgent';
let ws: WebSocket;

function connect() {
  console.log(`[${AGENT_ID}] Connecting to Event Bus at ${EVENT_BUS_URL}...`);
  ws = new WebSocket(EVENT_BUS_URL);

  ws.on('open', () => {
    console.log(`[${AGENT_ID}] Connected to Event Bus. Ready for sandboxed tasks.`);
    sendEvent('task_init', 'PENDING', `${AGENT_ID} is online and standing by.`);
  });

  ws.on('message', async (message: string) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'NEW_TASK' && parsed.payload?.assignedTo === AGENT_ID) {
        await executeTask(parsed.payload.taskId, parsed.payload.description);
      }
    } catch (err: any) {
      console.error(`[${AGENT_ID}] Error handling message:`, err.message);
    }
  });

  ws.on('close', () => {
    console.log(`[${AGENT_ID}] Disconnected. Reconnecting in 5s...`);
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    console.error(`[${AGENT_ID}] WebSocket error:`, err.message);
  });
}

async function executeTask(taskId: string, description: string) {
  console.log(`[${AGENT_ID}] Executing sandboxed task (${taskId}): ${description}`);

  try {
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Provisioning isolated E2B microVM...`);
    const sandbox = await globalSandboxManager.getOrCreateSandbox(AGENT_ID);

    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Running task in cloud environment...`);
    const res = await sandbox.runCommand('node -v');

    sendEvent(taskId, 'COMPLETED', `[Sandbox] Task completed cleanly!`, {
      stdout: res.stdout,
      exitCode: res.exitCode
    });
  } catch (err: any) {
    sendEvent(taskId, 'FAILED', `[Sandbox Error] ${err.message}`);
  }
}

function sendEvent(taskId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED', message: string, metadata?: any) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const eventPayload = {
    type: 'BLACKBOARD_EVENT',
    payload: {
      eventId: 'evt_' + Math.random().toString(36).slice(2, 8),
      taskId,
      timestamp: new Date().toLocaleTimeString(),
      sender: AGENT_ID,
      receiver: 'blackboard',
      status,
      message,
      metadata,
    },
  };

  ws.send(JSON.stringify(eventPayload));
}

if (require.main === module) {
  connect();
}
