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
        *   **Code & Agents:** Code file trees, diff viewers, the agent handoff visualization panel (Graph View vs. Sequence Timeline), and **Hugging Face model browser**.
*   **Flexible Model Selection:** Browse and download specialized agent models directly from Hugging Face Hub. Choose from thousands of open-source models (code generation, domain-specific reasoning, support automation) tailored to your workflow.
*   **LLM Routing & Fallback:** Intelligently route user prompts to OpenAI/Gemini APIs with automatic local fallback if cloud APIs are unavailable or rate-limited.
*   **Hybrid Model Architecture:** Minimize API token costs by routing routine tasks to free local models (via Ollama) and routing complex orchestration/logic to high-reasoning cloud models (via Gemini/Claude).

---

## 🛠️ Technology Stack

*   **Frontend:** React, Vite, TypeScript, Tailwind CSS, Monaco Editor (for code previews), React Flow (for handoff graphs).
*   **Backend Server:** Node.js (Express) running locally on localhost.
*   **Agent Orchestration:** Standardized JSON event bus (Blackboard pattern).
*   **Model Discovery & Selection:** Hugging Face Hub API integration with model browser UI and one-click download.
*   **LLM Routing:** OpenAI API with intelligent routing, local fallback responses, and task-type inference.
*   **Local Models:** Ollama (Qwen 2.5 Coder, Llama 3) and downloaded Hugging Face models.
*   **Cloud Models:** OpenAI (GPT-4 / GPT-3.5-Turbo), Gemini 2.5 Flash (via future LiteLLM integration).
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

1.  `cd server`
2.  `npm install`
3.  `cd ../client`
4.  `npm install`
5.  `cd ../server`
6.  `npm run dev`
7.  `cd ../client`
8.  `npm run dev`

> The current setup uses a local Express backend on port `3000` and a Vite frontend on port `5173`.

## ✅ Current Status

*   **Phase 2:** UI dashboard modules are fully implemented with all 10 sidebar sections.
*   **Phase 3:** Agent handoff visualizer is complete in the React client (Graph View, Sequence Timeline, Blackboard Logs).
*   **Phase 4:** LLM routing engine and Hugging Face model selection are complete:
    - OpenAI API integration with automatic fallback logic
    - Task type inference from natural language prompts
    - Hugging Face model browser with download capability
    - Backend async chat endpoint with agent task routing
*   **Security:** Server hardening applied (`helmet`, CORS restrictions, rate limiting, request size limits, hidden `x-powered-by`).
*   **Client:** API and WebSocket communication use same-origin relative connections for safer deployment.

For development and testing, you can enable a safe, auditable dev endpoint that grants or revokes the `Admin` role to a user in the mock CRM. This is intentionally gated behind an environment flag and should NEVER be enabled in production.

- Enable by setting the environment variable: `ALLOW_DEV_ADMIN_FREE_ACCESS=true` (or run in `NODE_ENV=development`).
- Endpoints (POST JSON { "email": "user@example.com" }):
    - `/api/admin/grant-dev` — Grants `Admin` role to the user with the given email.
    - `/api/admin/revoke-dev` — Reverts the user's role to `User`.

The server will emit a blackboard event when these endpoints are called so actions are visible in the audit/event stream.
