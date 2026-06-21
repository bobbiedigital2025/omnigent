# Project Design Requirements (PDR)

**Project Name:** Bobbie Digital Hub (BDH)  
**Author:** Bobbie Digital LLC & Antigravity  
**Version:** 1.0.0  
**Status:** Draft / Proposed  

---

## 1. Executive Summary & Goals
The goal of the **Bobbie Digital Hub** is to build a local-first, low-overhead application development and management portal. The system is tailored to allow a single developer or small agency to develop and maintain client applications with minimal manual labor, zero hosting/licensing fees for administrative suites, and agentic automation for support, health, and code generation.

### Key Objectives
*   **Decoupled Multi-Agent Systems:** A system where specialized agents run in the background and report state changes to a central event bus.
*   **Single Communication Channel:** The developer interacts exclusively with a single "Main Agent" who is responsible for directing workflows and presenting consolidated updates.
*   **Integrated CRM and Support:** Support tickets and user data for live client sites are directly accessible inside each app's workspace.
*   **Cost Efficiency:** Maximizing local open-source models (via Ollama) to keep operational costs close to $0.

---

## 2. Core Functional Specifications

### 2.1 Side-by-Side UI Layout
The viewport must be divided into two main panels:
1.  **Left Panel (The Conversational Console):**
    *   A persistent, modern chat window with the Main Agent.
    *   No logs or details from sub-agents should print here unless summarized by the Main Agent upon completion.
2.  **Right Panel (The Dynamic Workspace):**
    *   A header with two primary tabs: `[ Live App Preview ]` and `[ Developer Dashboard ]`.

### 2.2 The Developer Dashboard
When the Dashboard tab is active, a sidebar displays 10 specific modules:
*   **App Overview:** Displays basic metadata (git status, deployment URLs, active build logs, system health checks).
*   **Users (Live CRM):** Renders a table of registered users querying the live application's database. Features sorting, filtering, and custom user search.
*   **Support (Ticket CRM):** Displays support conversation threads. Supports:
    *   Reading incoming customer emails.
    *   Drafting/sending email replies.
    *   "Agent Draft Assist" which prompts the support agent to look up the user's details and suggest an automated email reply.
*   **Analytics & Health:** Displays charts of pageviews, response latency, memory leaks, and CPU spikes. Includes a button to execute agent-designed hotfixes.
*   **Marketing:** Simple settings panel for SEO configuration, email newsletter scheduling, and landing page metrics.
*   **Domains:** Domain name configuration, SSL certificate validation progress, and path redirects.
*   **Integrations:** Configures local MCP servers (e.g., enabling local file access, running SQL databases, or calling external search APIs).
*   **Security:** Lists firewall blocks, security scans, outdated npm packages, and access logs.
*   **Code:** A full IDE-style workspace containing a directory tree, file previewer, and git diff review screen.
*   **Agents (Visualizer):** The agent handoff interface. Toggles between:
    *   *Graph View:* Node-link diagram of running background agents.
    *   *Sequence View:* Chronological vertical timeline of agent handoffs.
    *   *Blackboard Logs:* Raw log entries showing JSON-RPC messages flowing between agents.

---

## 3. Core System Workflows

### 3.1 Scaffolding a New Client App
1.  User asks the Main Agent: *"Set up a new landing page app for client X."*
2.  Main Agent writes a task request to the Blackboard event bus.
3.  `Scaffold Agent` claims the task, creates a local directory, and initializes a React + Vite boilerplate.
4.  `Scaffold Agent` updates the task status to `Complete`.
5.  Main Agent notifies the user, and the Right Panel immediately updates to show the live local site in the `App Preview` tab.

### 3.2 Live Health & Hotfix Cycle
```
[Production App Error] -> [Analytics Hub Alerts Server]
                                |
                                v
                   [Agent analyzes logs & code]
                                |
                                v
               [Agent posts hotfix code to Dashboard]
                                |
                                v
             [User clicks "Approve & Apply Hotfix"]
                                |
                                v
                  [App hot-reloaded and running]
```

### 3.3 Agent-Assisted Customer Support
1.  An email arrives at `support@clientdomain.com` and is pushed to the local server.
2.  A Support Ticket is created in the dashboard under the `Support` tab.
3.  A background agent is dispatched to investigate the ticket:
    *   It queries the application database (via the DB MCP server) to find the user's account details.
    *   It inspects recent system logs for any actions associated with that user's ID.
4.  The agent drafts a response: *"I see your order failed due to card decline, but we have processed it now."*
5.  The developer reviews the draft on the Support dashboard and clicks **Send**.

---

## 4. Security & Privacy
*   **Sandboxing:** All client code must execute in isolated local directories.
*   **Credential Storage:** API keys for OpenAI/Anthropic/Gemini must be stored in a local `.env` file on the developer's machine and never transmitted to external dashboard servers.
*   **Database Isolation:** Client database connections must use local environment variables to connect directly to the respective staging/production databases.
