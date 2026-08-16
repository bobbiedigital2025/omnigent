import WebSocket from 'ws';
import { globalSandboxManager } from '../sandboxes/sandboxManager';
import { runGeminiPro } from '../llm/geminiClient';

const EVENT_BUS_URL = process.env.EVENT_BUS_URL || 'ws://localhost:3000';
const AGENT_ID = 'script_agent';
let ws: WebSocket;

function connect() {
  console.log(`[${AGENT_ID}] Connecting to Event Bus at ${EVENT_BUS_URL}...`);
  ws = new WebSocket(EVENT_BUS_URL);

  ws.on('open', () => {
    console.log(`[${AGENT_ID}] Connected to Event Bus. Standing by for screenplay analysis tasks.`);
    sendEvent('task_init', 'PENDING', 'Sandboxed Screenplay Agent is online and awaiting scripts.');
  });

  ws.on('message', async (message: string) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'NEW_TASK' && parsed.payload?.assignedTo === AGENT_ID) {
        await executeScriptBreakdown(parsed.payload.taskId, parsed.payload.description, parsed.payload.scriptContent);
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

async function executeScriptBreakdown(taskId: string, description: string, scriptContent?: string) {
  console.log(`[${AGENT_ID}] Executing screenplay breakdown task (${taskId}): ${description}`);

  try {
    // Step 1: Provision E2B Sandbox
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Provisioning isolated E2B microVM environment for screenplay analysis...`);
    const sandbox = await globalSandboxManager.getOrCreateSandbox(AGENT_ID);

    // Step 2: Write screenplay file into sandbox
    const rawScript = scriptContent || `EXT. CYBERPUNK ALLEY - NIGHT\n\nRain slicks the neon-drenched pavement. KAI (30s, leather jacket) checks his bio-monitor.\n\nKAI\n(into comms)\nThe grid is clear. Send the package.\n\nA sleek HOVER-SHIP descends overhead.`;
    
    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox] Writing screenplay artifact 'screenplay.fountain' into sandbox filesystem...`);
    await sandbox.writeFile('screenplay.fountain', rawScript);

    // Step 3: Run Gemini 2.5 Pro Scene Extraction
    sendEvent(taskId, 'IN_PROGRESS', `[Gemini 2.5 Pro] Analyzing screenplay structure, scene headings, and character shot lists...`);
    
    const prompt = `Analyze this screenplay text and extract a structured scene breakdown, shot list, and estimated budget:\n\n${rawScript}`;
    const analysisResult = await runGeminiPro(prompt);

    // Step 4: Write breakdown output file in sandbox
    await sandbox.writeFile('scene_breakdown.json', JSON.stringify({ rawScript, analysisResult }, null, 2));

    sendEvent(taskId, 'IN_PROGRESS', `[Sandbox Execution Output]\n${analysisResult}`);

    sendEvent(taskId, 'COMPLETED', `[Sandbox] Screenplay breakdown completed cleanly!`, {
      sandboxType: sandbox.type,
      analysis: analysisResult,
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
