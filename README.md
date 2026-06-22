# Omnigent

Omnigent is a cloud-first, agent-augmented workspace and application lifecycle manager designed for **Bobbie Digital LLC**. It enables a single developer to design, build, test, deploy, monitor, and support multiple client applications from a single unified interface.

---

## 🚀 Key Features

*   **Single-Chat Interface:** Communicate with a single "Main Agent" who coordinates multiple specialized background agents using Model Context Protocol (MCP) and Agent-to-Agent (A2A) event-driven communication.
*   **Dual-View Workspace (Side-by-Side):**
    *   **App Preview:** A hot-reloading browser preview of your active application.
    *   **Developer Dashboard:** A unified admin panel containing views for:
        *   **App Overview:** Live health metrics and task lists.
        *   **Users (Live CRM):** Customer profiles, accounts, and signups.
        *   **Support Ticket CRM:** Integrated email inbox (`support@yourdomain.com`) with agent-assisted reply drafting.
        *   **Code & Agents:** Code file trees, diff viewers, and the agent handoff visualization panel (Graph View vs. Sequence Timeline).
*   **Hybrid Model Architecture:** Minimize API token costs by routing routine tasks to free local models (via Ollama) and routing complex orchestration/logic to high-reasoning cloud models (via Gemini/Claude).

---

## 🛠️ Technology Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS, Monaco Editor (for code previews), React Flow (for handoff graphs).
*   **Backend Server:** Node.js (Express) or Python (FastAPI) running locally on localhost.
*   **Agent Orchestration:** Standardized JSON event bus (Blackboard pattern).
*   **Local Models:** Ollama (Qwen 2.5 Coder, Llama 3).
*   **Cloud Models:** LiteLLM / unified API gateway routing to Gemini 2.5 Flash / Claude 3.5 Sonnet.
*   **Integrations:** Model Context Protocol (MCP) servers (Filesystem, Terminal, Database).

---

## 📂 Directory Structure

```text
bobbie-digital-hub/
├── README.md                 # Project Overview & Setup
├── PDR.md                    # Project Design Requirements Document
├── blueprint.md              # System Architecture & Development Phases
├── server/                   # Backend Local Server (Orchestrator & Event Bus)
│   ├── src/
│   │   ├── agents/           # Specialized Agent Prompts & Core Logic
│   │   ├── mcp/              # MCP Server Connectors
│   │   ├── bus/              # Central Blackboard/Event Bus
│   │   └── index.ts          # Express Server Entrypoint
│   └── package.json
└── client/                   # Frontend UI (React + Vite)
    ├── src/
    │   ├── components/       # Chat, Graph, Dashboard Modules
    │   ├── hooks/            # WebSocket connectors
    │   └── App.tsx
    └── package.json
```

---

## 🏁 Getting Started

*(Development instructions will be populated here once Phase 1 begins).*

## Dev-only admin helper

For development and testing, you can enable a safe, auditable dev endpoint that grants or revokes the `Admin` role to a user in the mock CRM. This is intentionally gated behind an environment flag and should NEVER be enabled in production.

- Enable by setting the environment variable: `ALLOW_DEV_ADMIN_FREE_ACCESS=true` (or run in `NODE_ENV=development`).
- Endpoints (POST JSON { "email": "user@example.com" }):
    - `/api/admin/grant-dev` — Grants `Admin` role to the user with the given email.
    - `/api/admin/revoke-dev` — Reverts the user's role to `User`.

The server will emit a blackboard event when these endpoints are called so actions are visible in the audit/event stream.
