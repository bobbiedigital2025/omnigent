import WebSocket from 'ws';
import { globalSandboxManager } from '../sandboxes/sandboxManager';

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'ws://localhost:3000';
const AGENT_ID = 'coder_agent';
let ws: WebSocket;

function connect() {
  console.log(`[${AGENT_ID}] Connecting to Event Bus at ${EVENT_BUS_URL}...`);
  ws = new WebSocket(EVENT_BUS_URL);

  ws.on('open', () => {
    console.log(`[${AGENT_ID}] Connected to Event Bus. Ready for sandboxed code tasks.`);
    sendEvent('task_init', 'PENDING', 'Sandboxed Coder Agent is online and awaiting instructions.');
  });

  ws.on('message', async (message: string) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'NEW_TASK' && parsed.payload?.assignedTo === AGENT_ID) {
        await executeSandboxedTask(parsed.payload.taskId, parsed.payload.description, parsed.payload.code);
      }
    } catch (err: any) {
      console.error(`[${AGENT_ID}] Error handling event message:`, err.message);
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

async function executeSandboxedTask(taskId: string, description: string, codeSnippet?: string) {
  console.log(`[${AGENT_ID}] Executing sandboxed task (${taskId}): ${description}`);

  try {
    // Step 1: Initialize Sandbox
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Provisioning isolated execution sandbox for ${AGENT_ID}...`);
    const sandbox = await globalSandboxManager.getOrCreateSandbox(AGENT_ID);
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Environment ready (${sandbox.type}). Initializing workspace...`);

    // Step 2: Write main script into sandbox environment
    const fileName = 'app.js';
    const sampleCode = codeSnippet || `// Auto-generated module\nconsole.log("Hello from sandboxed agent context!");\nconsole.log("Task objective: ${description}");\n`;
    
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Writing code artifact '${fileName}' into sandbox filesystem...`);
    await sandbox.writeFile(fileName, sampleCode);

    // Step 3: Execute code inside sandbox
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Executing 'node ${fileName}' inside isolated microVM...`);
    const result = await sandbox.runCommand(`node ${fileName}`);

    // Step 4: Stream terminal output back to Blackboard Event Bus
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox Execution Output]\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);

    if (result.exitCode === 0) {
      sendEvent(taskId, 'COMPLETED', `[Sandbox] Task completed successfully in isolated environment!`, {
        exitCode: result.exitCode,
        stdout: result.stdout,
        sandboxType: sandbox.type,
      });
    } else {
      sendEvent(taskId, 'FAILED', `[Sandbox] Task failed with exit code ${result.exitCode}`, {
        stderr: result.stderr,
      });
    }
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

// Start agent process if run directly
if (require.main === module) {
  connect();
}
