# CineAgent Studio OS 🎬
**Autonomous Multi-Agent Cinema Production & Observability Studio**

*Submitted to the Google Cloud Agentic Cinema Hackathon (Grafana Track)*

---

## 🚀 Overview

**CineAgent Studio OS** is an autonomous, agent-augmented studio control room designed for independent filmmakers, screenwriters, VFX supervisors, and post-production managers.

It solves both key bottlenecks in modern film production:
1. **Pre-Production Bottleneck:** Automated screenplay scene breakdown, shot listing, and budget estimation.
2. **Studio Compute Bottleneck:** Real-time GPU render farm observability, LLM token cost tracking, and incident alert resolution.

---

## 🛠️ Technology Stack & Runtime Evidence

- **AI Models & SDKs (Google Cloud AI):** Built on `@google/genai` using **Gemini 2.5 Pro** (screenplay analysis) and **Gemini 2.5 Flash** (fast tool execution & telemetry parsing). *(Satisfies Hackathon Rules 56 & 68)*.
- **Grafana Cloud MCP Server (`@grafana/mcp-grafana`):** Integrates Grafana Cloud MCP Server via JSON-RPC for querying Prometheus metrics, Loki logs, and active studio alerts at runtime. *(Satisfies Hackathon Rule 73)*.
- **Sandboxed Agent Execution:** MicroVM isolated worker agents running inside **E2B Cloud Sandboxes**.
- **Event Bus & Architecture:** Asynchronous JSON Event Bus (Blackboard Pattern) running over WebSockets (`ws://localhost:3000`).
- **Frontend & UI:** React 19 + Vite + TypeScript split-pane dashboard with real-time sequence timelines and telemetry charts.

---

## 📂 Project Structure

```text
omnigent/
├── LICENSE                         # MIT Open Source License
├── README.md                       # Project Documentation
├── server/                         # Express Backend & Event Bus
│   ├── src/
│   │   ├── llm/
│   │   │   └── geminiClient.ts     # Google GenAI SDK (@google/genai) integration
│   │   ├── mcp/
│   │   │   └── grafanaConnector.ts # Grafana Cloud MCP Server Connector
│   │   ├── sandboxes/
│   │   │   └── sandboxManager.ts   # E2B Cloud MicroVM Sandbox Manager
│   │   ├── telemetry/
│   │   │   └── studioMetricsEmitter.ts # Real-time cinema telemetry emitter
│   │   ├── agents/
│   │   │   ├── sandboxedScriptAgent.ts     # Gemini 2.5 Pro screenplay breakdown
│   │   │   ├── sandboxedStudioOpsAgent.ts  # Gemini 2.5 Flash Grafana ops agent
│   │   │   ├── sandboxedCoderAgent.ts      # Sandboxed code execution
│   │   │   └── sandboxedSecurityAgent.ts   # Sandboxed security auditor
│   │   └── app.ts                  # Express REST routes & WebSocket server
│   └── package.json
└── client/                         # React Frontend Studio UI
    ├── src/
    │   ├── App.tsx                 # Studio Dashboard & Chat Interface
    │   └── App.css
    └── package.json
```

---

## 🏁 Quick Start & Running Locally

### 1. Environment Configuration
Create `server/.env`:
```env
GEMINI_API_KEY=your_gemini_api_key
E2B_API_KEY=your_e2b_api_key
GRAFANA_API_KEY=your_grafana_api_key
EVENT_BUS_URL=ws://localhost:3000
```

### 2. Start the Backend Server & Event Bus
```bash
cd server
npm install
npm run dev
```

### 3. Launch Sandboxed Cinema Agents
In separate terminal windows:
```bash
cd server

# Launch Sandboxed Screenplay Agent
npm run agent:script:sandboxed

# Launch Sandboxed Studio Ops Agent
npm run agent:ops:sandboxed
```

### 4. Start the Frontend Workspace
```bash
cd client
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 📜 License

Licensed under the [MIT License](LICENSE).
