# System Blueprint & Development Roadmap

This document outlines the system architecture, component schemas, and phased roadmap for building **Omnigent**.

---

## 1. Architectural Architecture

The system operates as three decoupled local services:

```
                  +--------------------------------+
                  |           React UI             |
                  |  (Left: Chat | Right: Dash)    |
                  +--------------------------------+
                                  ^
                                  | WebSocket (Events & Logs)
                                  v
                  +--------------------------------+
                  |      Local Express Server      |
                  |  - Blackboard (Event Bus)      |
                  |  - Local File Scaffold API     |
                  +--------------------------------+
                     ^            ^             ^
                     |            |             | Local IPC / TCP
                     v            v             v
              [Main Bot]    [Coder Agent]  [Support Agent]
              (Orchestrator) (Local Worker) (Context Analyst)
                     |            |             |
                     +------------+-------------+
                                  |
                                  v
                     +--------------------------+
                     |  MCP Servers (FS, DB)    |
                     +--------------------------+
```

### 1.1 The Local Express Server (The Core)
*   Acts as the central Event Bus and coordinates connection channels.
*   Runs on port `3000`.
*   Broadcasts all task state updates to the React client via WebSockets.
*   Handles inbound support emails (webhook endpoint) and saves them to local project workspaces.

### 1.2 Agent Runners
*   Independent processes (Node.js/TypeScript or Python) that connect to the Local Express Server.
*   They use **cloud APIs** (via LiteLLM / Gemini SDK / Anthropic SDK) for heavy reasoning to save local RAM, running local commands only as needed.
*   They call **MCP Servers** directly using the JSON-RPC standard to interact with files, run terminal commands, or check database schemas.

---

## 2. Event & State Schema (The Blackboard)

The central server maintains a state array of active and historic tasks. When an agent updates a task, it posts a message with the following schema:

```json
{
  "eventId": "evt_987654",
  "taskId": "task_123",
  "timestamp": "2026-06-21T04:25:00Z",
  "sender": "coder_agent",
  "receiver": "blackboard",
  "status": "IN_PROGRESS",
  "message": "Writing auth router inside src/auth.js",
  "metadata": {
    "model": "qwen2.5-coder:7b",
    "promptTokens": 1024,
    "completionTokens": 512,
    "elapsedMs": 2400
  }
}
```

The React UI listens to this event stream and automatically updates:
*   The **Agent Graph Node** for `coder_agent` (turns it pulse orange/active).
*   The **Sequence Timeline** (adds a horizontal connection line from `Main Bot` to `Coder Agent` at the corresponding timestamp).

---

## 3. Development Roadmap

We will build the Bobbie Digital Hub in 5 distinct phases to ensure stability, easy testing, and cost management.

```mermaid
gantt
    title Development Phases
    dateFormat  YYYY-MM-DD
    section Backend Core
    Phase 1: Local Server & Event Bus   :active, des1, 2026-06-21, 5d
    section Frontend
    Phase 2: React Core Dashboard       :         des2, after des1, 6d
    Phase 3: Visual Handoff & Flow      :         des3, after des2, 5d
    section Agent Layer
    Phase 4: Local Ollama & LLM Routing :         des4, after des3, 7d
    section CRM & Live App Features
    Phase 5: CRM, Support Mail, & Ops  :         des5, after des4, 8d
```

### Phase 1: Local Server & Event Bus
*   **Goal:** Build the backbone communication loop.
*   **Tasks:**
    *   Create the Express/TypeScript workspace.
    *   Implement the WebSocket server with event channels for `chat`, `events`, and `logs`.
    *   Set up a mock agent client script that generates simulated Blackboard events.

### Phase 2: React Core Dashboard UI
*   **Goal:** Create a stunning, high-fidelity developer workspace.
*   **Tasks:**
    *   Set up React + Vite + TypeScript.
    *   Build the split-pane layout: Left Chat (Main Agent), Right Pane (Toggle: Preview / Dashboard).
    *   Build the Dashboard Sidebar with the 10 navigation choices.
    *   Integrate a mockup Monaco Editor for the "Code" module and standard dashboard grids.

## 3.5 Current Implementation Status
*   Phase 2 dashboard UI is implemented and functional with all 10 sidebar modules.
*   Phase 3 visualizer has been completed and is now part of the React client (Graph, Sequence, Logs views).
*   Phase 4 LLM routing is now complete:
    - OpenAI integration with fallback logic
    - Hugging Face model browser and download capability
    - Async task dispatch with Blackboard event emission
    - Intelligent prompt-to-agent routing
*   Security hardening is active in the backend and client communications (helmet, CORS, rate-limiting, payload limits).

### Phase 3: Visual Handoff & Flow (The Visualizer)
*   **Goal:** Render the dynamic sequences and graphs.
*   **Tasks:**
    *   Integrate `React Flow` for the Node-Link diagram.
    *   Build a custom chronological waterfall component (Sequence Timeline) that renders WebSocket events.
    *   Implement the Drawer Inspector to inspect prompts/response parameters for selected events.

### Phase 4: LLM API Routing, Model Selection & Agent Workers
*   **Goal:** Connect the Main Agent and background workers using cloud LLM APIs, enable Hugging Face model discovery, and conserve local memory.
*   **Completed Tasks:**
    *   ✅ Integrate OpenAI API routing with task-type inference (routes prompts to appropriate agent).
    *   ✅ Implement local fallback responses when cloud APIs are unavailable or rate-limited.
    *   ✅ Build Hugging Face Hub integration: model search, download, and manifest management.
    *   ✅ Create dashboard "Agents" panel with Hugging Face model browser UI.
    *   ✅ Implement backend async `/api/chat` endpoint with LLM routing and agent task dispatch.
    *   ✅ Set up event emission to Blackboard for task tracking and real-time UI updates.
*   **Pending Tasks:**
    *   Integrate LiteLLM for multi-provider routing (Gemini, Claude, local Ollama).
    *   Connect background agents to read/write files via local/cloud MCP server integration.
    *   Enhance task-type inference with semantic analysis of user prompts.

### Phase 5: CRM, Support Mail, & Production Operations
*   **Goal:** Connect the platform to live production apps and set up legal/compliance structures.
*   **Tasks:**
    *   Implement DB connectors in the `Users` tab to inspect live cloud databases (Supabase, Firebase, or Postgres).
    *   Build an inbound email receiver (SendGrid Inbound Parse or similar) to convert support mail to tickets in the `Support` tab.
    *   Equip the Support Agent with DB and log lookup prompts to auto-draft ticket replies.
    *   Build the compliance component: Cookie Banner component, Terms of Service renderer, and GDPR data download/deletion tools.
