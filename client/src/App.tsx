import { useState, useEffect, useMemo, useRef } from 'react';
import ReactFlow, { ReactFlowProvider, Background, Controls, MiniMap } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Terminal, Users, LifeBuoy, Activity, Megaphone, 
  Globe, Database, Shield, Code, Workflow, Send, Eye,
  Trash2, Download, X, Play, RefreshCw, CheckCircle, ShieldAlert, FileCode, Search
} from 'lucide-react';
import './App.css';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  time: string;
}

interface EventMessage {
  eventId: string;
  taskId: string;
  timestamp: string;
  sender: string;
  receiver: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  message: string;
  metadata?: any;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  joined: string;
}

interface Ticket {
  id: string;
  userEmail: string;
  subject: string;
  status: string;
  priority: string;
  messages: Array<{ sender: 'user' | 'support'; text: string; time: string }>;
  draft?: string;
}

interface HuggingFaceModelInfo {
  id: string;
  author: string;
  tags: string[];
  pipeline_tag: string | null;
  downloads: number;
  description?: string;
}

function App() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'preview' | 'dashboard'>('dashboard');
  const [activeModule, setActiveModule] = useState<string>('overview');
  
  // Chat console states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'agent',
      text: 'Welcome back! I am your Main Orchestrator Agent. Let me know what you want to develop or monitor today. \n\nQuick actions: \n- "Scaffold landing page" to set up a new React app. \n- "Fix memory leak" to inspect production metrics and apply a hotfix.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  
  // Live states
  const [isScaffolded, setIsScaffolded] = useState(false);
  const [eventLogs, setEventLogs] = useState<EventMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('tkt_001');
  const [replyText, setReplyText] = useState('');
  
  // Compliance Modals
  const [showCookieBanner, setShowCookieBanner] = useState(true);
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState({
    essential: true,
    analytics: true,
    marketing: false
  });
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  
  // Telemetry & Hotfix states
  const [telemetry, setTelemetry] = useState({
    isLeakActive: true,
    currentMemoryUsage: 82,
    cpuUsage: 12,
    pageViews: 1422,
    latency: 420
  });

  // Code Explorer states
  const [selectedFile, setSelectedFile] = useState('src/App.tsx');
  const [hfSearchTerm, setHfSearchTerm] = useState('agent');
  const [huggingFaceModels, setHuggingFaceModels] = useState<HuggingFaceModelInfo[]>([]);
  const [hfLoading, setHfLoading] = useState(false);
  const [hfError, setHfError] = useState<string | null>(null);
  const [hfDownloadMessage, setHfDownloadMessage] = useState<string | null>(null);

  const fileContents: Record<string, string> = {
    'src/App.tsx': `import React from 'react';\n\nexport default function App() {\n  return (\n    <div className="landing-page">\n      <h1>Welcome to Bobbie Digital LLC</h1>\n      <p>Custom agentic workflows and web application engineering.</p>\n    </div>\n  );\n}`,
    'src/server.ts': `import express from 'express';\nimport http from 'http';\n\nconst app = express();\nconst server = http.createServer(app);\n\n// Example: ensure socket listeners are cleaned up on close to avoid leaks\nserver.on('connection', (socket) => {\n  console.log('New client connection');\n  socket.on('close', () => {\n    socket.removeAllListeners();\n    console.log('Client disconnected and listeners removed');\n  });\n});\n`,
    'package.json': `{\n  "name": "client-app",\n  "private": true,\n  "version": "1.0.0",\n  "dependencies": {\n    "react": "^19.0.0"\n  }\n}`,
    'git diff': `diff --git a/src/server.ts b/src/server.ts\nindex e3490b..fa0102 100644\n--- a/src/server.ts\n+++ b/src/server.ts\n@@ -8,5 +8,6 @@ const server = http.createServer(app);\n \n server.on('connection', (socket) => {\n   console.log('New client connection');\n+  socket.on('close', () => socket.removeAllListeners());\n });`
  };

  // Integration connectors
  const [mcpIntegrations] = useState([
    { name: 'Local Filesystem Connector', type: 'Filesystem', status: 'Connected', port: '8081' },
    { name: 'Postgres DB Server Connection', type: 'Database', status: 'Connected', port: '5432' },
    { name: 'Tavily Search API gateway', type: 'Search', status: 'Disconnected', port: 'N/A' }
  ]);

  // Web Browser Landing Page preview dark mode state
  const [previewDarkMode, setPreviewDarkMode] = useState(true);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  const apiGet = (path: string) => fetch(`${BASE_URL}${path}`).then(res => res.json());
  const apiPost = (path: string, body?: any) => fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  }).then(res => res.json());

  // Setup WS Connection
  useEffect(() => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${scheme}://${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to local event bus.');
    };

    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'SYNC_HISTORY') {
        setEventLogs(parsed.payload);
      } else if (parsed.type === 'BLACKBOARD_EVENT') {
        setEventLogs(prev => [...prev, parsed.payload]);
      } else if (parsed.type === 'CHAT_MESSAGE') {
        setChatMessages(prev => [...prev, parsed.payload]);
      } else if (parsed.type === 'PREVIEW_STATE') {
        setIsScaffolded(parsed.payload.active);
        setActiveTab('preview');
      } else if (parsed.type === 'TELEMETRY_UPDATE') {
        setTelemetry(prev => ({
          ...prev,
          isLeakActive: parsed.payload.isLeakActive,
          currentMemoryUsage: parsed.payload.currentMemoryUsage
        }));
      } else if (parsed.type === 'TICKET_DRAFTED') {
        const { ticketId, draft } = parsed.payload;
        setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, draft } : t));
        if (selectedTicketId === ticketId) {
          setReplyText(draft);
        }
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from local event bus.');
    };

    return () => {
      ws.close();
    };
  }, []);

  // Poll Telemetry & Load CRM data
  useEffect(() => {
    const fetchStats = () => {
      apiGet('/api/telemetry')
        .then(data => setTelemetry(data))
        .catch(err => console.log('Failed to fetch telemetry:', err));
    };

    const fetchCRM = () => {
      apiGet('/api/users')
        .then(data => setUsers(data))
        .catch(err => console.log('Failed to fetch CRM users:', err));

      apiGet('/api/tickets')
        .then(data => setTickets(data))
        .catch(err => console.log('Failed to fetch support tickets:', err));
    };

    fetchCRM();
    fetchStats();

    const interval = setInterval(() => {
      fetchStats();
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeModule === 'agents') {
      fetchHuggingFaceModels(hfSearchTerm);
    }
  }, [activeModule]);

  const fetchHuggingFaceModels = (query = 'agent') => {
    setHfLoading(true);
    setHfError(null);

    apiGet(`/api/agents/huggingface?q=${encodeURIComponent(query)}`)
      .then(data => {
        if (data?.status === 'success' && Array.isArray(data.models)) {
          setHuggingFaceModels(data.models);
        } else {
          setHfError('No models found for that query.');
        }
      })
      .catch(err => {
        setHfError(err.message || 'Failed to load Hugging Face models.');
      })
      .finally(() => setHfLoading(false));
  };

  const downloadHuggingFaceAgentModel = (modelId: string) => {
    setHfDownloadMessage(`Downloading ${modelId}...`);
    apiPost('/api/agents/huggingface/download', { modelId })
      .then(data => {
        if (data?.status === 'success') {
          setHfDownloadMessage(`Downloaded ${modelId} to ${data.result.localPath}`);
        } else {
          setHfDownloadMessage(`Download failed: ${data?.error || 'unknown error'}`);
        }
      })
      .catch(err => {
        setHfDownloadMessage(`Download failed: ${err.message || err}`);
      });
  };

  // Update selected ticket draft text
  useEffect(() => {
    const t = tickets.find(tkt => tkt.id === selectedTicketId);
    if (t) {
      setReplyText(t.draft || '');
    }
  }, [selectedTicketId, tickets]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Handle send message
  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');

    // Broadcast user chat over websocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'SEND_CHAT',
        payload: userMsg
      }));
    }

    apiPost('/api/chat', { message: text }).catch(err => console.error('Error posting message:', err));
  };

  // Run scaffold
  const triggerScaffold = () => {
    handleSendMessage('Scaffold a landing page app');
  };

  // Run hotfix
  const triggerHotfix = () => {
    handleSendMessage('Fix memory leak');
  };

  // Send Ticket Reply
  const sendTicketReply = () => {
    if (!replyText.trim()) return;
    apiPost('/api/tickets/reply', { ticketId: selectedTicketId, text: replyText })
      .then(data => {
        setTickets(prev => prev.map(t => t.id === selectedTicketId ? data.ticket : t));
        setReplyText('');
      })
      .catch(err => console.error('Error replying to ticket:', err));
  };

  // Request Agent Draft Assist
  const requestDraftAssist = () => {
    apiPost('/api/tickets/draft-assist', { ticketId: selectedTicketId })
      .catch(err => console.error('Error requesting draft assist:', err));
  };

  // Export GDPR user data
  const exportUserData = (userId: string) => {
    apiPost('/api/users/export', { id: userId })
      .then(data => {
        const fileData = JSON.stringify(data.data, null, 2);
        const blob = new Blob([fileData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `user_gdpr_export_${userId}.json`;
        link.click();
      })
      .catch(err => console.error('Error exporting user data:', err));
  };

  // Delete GDPR user data
  const deleteUserData = (userId: string) => {
    if (!confirm('Are you sure you want to permanently delete this user profile? This fulfills CCPA/GDPR Right to be Forgotten requirements.')) return;
    
    apiPost('/api/users/delete', { id: userId })
      .then(() => {
        setUsers(prev => prev.filter(u => u.id !== userId));
      })
      .catch(err => console.error('Error deleting user:', err));
  };

  // Render Visualizer Graph Helper
  const getActiveAgentName = (): string => {
    if (eventLogs.length === 0) return '';
    const lastEvent = eventLogs[eventLogs.length - 1];
    return lastEvent.status === 'IN_PROGRESS' ? lastEvent.sender : '';
  };

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorData, setInspectorData] = useState<any>(null);

  const activeAgentNames = useMemo(() => {
    const set = new Set<string>();
    eventLogs.forEach((evt) => {
      set.add(evt.sender);
      set.add(evt.receiver);
    });
    return set;
  }, [eventLogs]);

  const rfNodes = useMemo<Node[]>(() => [
    {
      id: 'main',
      data: { label: 'Main Bot' },
      position: { x: 50, y: 50 },
      style: {
        background: activeAgentNames.has('Main Bot') ? 'rgba(124, 58, 237, 0.25)' : 'rgba(15, 23, 42, 0.95)',
        border: activeAgentNames.has('Main Bot') ? '1px solid #7c3aed' : '1px solid rgba(255,255,255,0.08)',
      }
    },
    {
      id: 'coder',
      data: { label: 'Coder / Scaffold' },
      position: { x: 300, y: 50 },
      style: {
        background: activeAgentNames.has('Scaffold Agent') || activeAgentNames.has('Coder Agent') ? 'rgba(59, 130, 246, 0.18)' : 'rgba(15, 23, 42, 0.95)',
        border: activeAgentNames.has('Scaffold Agent') || activeAgentNames.has('Coder Agent') ? '1px solid #2563eb' : '1px solid rgba(255,255,255,0.08)',
      }
    },
    {
      id: 'support',
      data: { label: 'Support Agent' },
      position: { x: 550, y: 50 },
      style: {
        background: activeAgentNames.has('Support Agent') ? 'rgba(34, 197, 94, 0.18)' : 'rgba(15, 23, 42, 0.95)',
        border: activeAgentNames.has('Support Agent') ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)',
      }
    }
  ], [activeAgentNames]);

  const rfEdges = useMemo<Edge[]>(() => [
    {
      id: 'e1-2',
      source: 'main',
      target: 'coder',
      animated: activeAgentNames.has('Scaffold Agent') || activeAgentNames.has('Coder Agent')
    },
    {
      id: 'e2-3',
      source: 'coder',
      target: 'support',
      animated: activeAgentNames.has('Support Agent')
    }
  ], [activeAgentNames]);

  const openInspectorForEvent = (evt: EventMessage) => {
    setInspectorData({ type: 'event', event: evt });
    setInspectorOpen(true);
  };

  const openInspectorForNode = (node: Node) => {
    setInspectorData({ type: 'node', node });
    setInspectorOpen(true);
  };

  return (
    <div className="app-container">
      {/* Left panel: chat console */}
      <div className="left-panel">
        <div className="console-header">
          <div className="status-dot"></div>
          <h2>OMNIGENT ORCHESTRATOR</h2>
        </div>
        
        <div className="chat-history">
          {chatMessages.map(msg => (
            <div key={msg.id} className={`chat-bubble ${msg.sender}`}>
              {msg.text}
              <span className="time">{msg.time}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-actions">
          <button className="action-btn" onClick={triggerScaffold}>
            <Play size={13} /> Scaffold App
          </button>
          <button className="action-btn" onClick={triggerHotfix}>
            <RefreshCw size={13} /> Run Hotfix
          </button>
          <button className="action-btn" onClick={() => setShowPrivacyModal(true)}>
            Privacy Policy
          </button>
          <button className="action-btn" onClick={() => setShowTermsModal(true)}>
            Terms of Service
          </button>
        </div>

        <form className="chat-input-form" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
          <input 
            type="text" 
            className="chat-input"
            placeholder="Ask Main Bot to build or fix things..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button type="submit" className="chat-send-btn">
            <Send size={16} />
          </button>
        </form>
      </div>

      {/* Right panel: dashboard workspaces */}
      <div className="right-panel">
        <div className="workspace-tabs">
          <button 
            className={`tab-link ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            App Preview
          </button>
          <button 
            className={`tab-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Developer Dashboard
          </button>
        </div>

        <div className="tab-content-container">
          {activeTab === 'preview' ? (
            <div className="preview-panel">
              <div className="browser-bar">
                <div className="browser-dots">
                  <div className="browser-dot" style={{ backgroundColor: '#ef4444' }}></div>
                  <div className="browser-dot" style={{ backgroundColor: '#eab308' }}></div>
                  <div className="browser-dot" style={{ backgroundColor: '#22c55e' }}></div>
                </div>
                <div className="browser-address">
                  {isScaffolded ? 'https://bobbiedigital-client-x.staging.local' : 'about:blank'}
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                  onClick={() => setPreviewDarkMode(!previewDarkMode)}
                >
                  Toggle Theme
                </button>
              </div>
              <div className="preview-iframe-mock">
                {isScaffolded ? (
                  <div className="preview-app-render" style={{
                    padding: '40px',
                    height: '100%',
                    backgroundColor: previewDarkMode ? '#0f172a' : '#f8fafc',
                    color: previewDarkMode ? '#f8fafc' : '#0f172a',
                    transition: 'all 0.3s'
                  }}>
                    <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                      <h2 style={{ fontSize: '20px', color: previewDarkMode ? '#c084fc' : '#9333ea' }}>Bobbie Digital Landing</h2>
                      <nav style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
                        <span>Home</span>
                        <span>Solutions</span>
                        <span>Contact</span>
                      </nav>
                    </header>
                    <main style={{ marginTop: '60px', textAlign: 'center' }}>
                      <h1 style={{ fontSize: '36px', fontWeight: 800 }}>Agent-Driven Scaling for SaaS</h1>
                      <p style={{ marginTop: '16px', color: previewDarkMode ? '#94a3b8' : '#64748b', fontSize: '15px' }}>
                        Accelerate application building using secure local and high-reasoning cloud orchestration.
                      </p>
                      <button style={{
                        marginTop: '30px',
                        backgroundColor: '#9333ea',
                        color: 'white',
                        padding: '10px 24px',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}>
                        Explore Deployments
                      </button>
                    </main>
                  </div>
                ) : (
                  <div className="no-preview">
                    <Eye size={44} className="text-muted" />
                    <h3>No Active App Preview</h3>
                    <p>Trigger "Scaffold App" or click the shortcut button on the left to begin.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="dashboard-layout">
              {/* Sidebar navigation */}
              <div className="dashboard-sidebar">
                <button className={`sidebar-btn ${activeModule === 'overview' ? 'active' : ''}`} onClick={() => setActiveModule('overview')}>
                  <Terminal size={15} /> App Overview
                </button>
                <button className={`sidebar-btn ${activeModule === 'users' ? 'active' : ''}`} onClick={() => setActiveModule('users')}>
                  <Users size={15} /> Users (Live CRM)
                </button>
                <button className={`sidebar-btn ${activeModule === 'support' ? 'active' : ''}`} onClick={() => setActiveModule('support')}>
                  <LifeBuoy size={15} /> Support CRM
                </button>
                <button className={`sidebar-btn ${activeModule === 'analytics' ? 'active' : ''}`} onClick={() => setActiveModule('analytics')}>
                  <Activity size={15} /> Analytics & Health
                </button>
                <button className={`sidebar-btn ${activeModule === 'marketing' ? 'active' : ''}`} onClick={() => setActiveModule('marketing')}>
                  <Megaphone size={15} /> Marketing
                </button>
                <button className={`sidebar-btn ${activeModule === 'domains' ? 'active' : ''}`} onClick={() => setActiveModule('domains')}>
                  <Globe size={15} /> Domains
                </button>
                <button className={`sidebar-btn ${activeModule === 'integrations' ? 'active' : ''}`} onClick={() => setActiveModule('integrations')}>
                  <Database size={15} /> Integrations
                </button>
                <button className={`sidebar-btn ${activeModule === 'security' ? 'active' : ''}`} onClick={() => setActiveModule('security')}>
                  <Shield size={15} /> Security
                </button>
                <button className={`sidebar-btn ${activeModule === 'code' ? 'active' : ''}`} onClick={() => setActiveModule('code')}>
                  <Code size={15} /> Code & Git
                </button>
                <button className={`sidebar-btn ${activeModule === 'agents' ? 'active' : ''}`} onClick={() => setActiveModule('agents')}>
                  <Workflow size={15} /> Agents Visualizer
                  <span className="sidebar-badge">HF</span>
                </button>
              </div>

              {/* Module Content */}
              <div className="dashboard-content">
                {/* 1. App Overview */}
                {activeModule === 'overview' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Application Overview</h3>
                        <p>Bobbie Digital LLC staging status and build channels.</p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className="action-btn"><CheckCircle size={13} color="#10b981" /> Build Success</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                      <div className="metric-card">
                        <h4>Active Branch</h4>
                        <div className="value">main</div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Latest commit: Feat: Added Blackboard event channels</p>
                      </div>
                      <div className="metric-card">
                        <h4>Deployment Endpoint</h4>
                        <div className="value" style={{ fontSize: '16px', marginTop: '12px' }}>
                          <a href="https://bobbiedigital-client-x.staging.local" style={{ color: 'var(--accent-purple)' }}>
                            bobbiedigital-client-x.staging.local
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="metric-card" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4>Agent Browser Shortcut</h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Quickly open the Hugging Face Agent Browser to find and download new agent models.
                        </p>
                      </div>
                      <button className="btn btn-primary" type="button" onClick={() => setActiveModule('agents')}>
                        Open Agent Browser
                      </button>
                    </div>

                    <h4 style={{ marginBottom: '8px' }}>Live Build Console Logs</h4>
                    <div className="blackboard-log-output" style={{ color: '#a9b1d6', height: '220px' }}>
                      {`[INFO] 2026-06-21T19:03:00Z: Starting dev server...\n[INFO] 2026-06-21T19:03:02Z: Vite dev server running on port 5173\n[INFO] 2026-06-21T19:03:05Z: WebSocket logs attached.\n[SUCCESS] 2026-06-21T19:03:06Z: Cold compilation successful (320ms).\n[INFO] 2026-06-21T19:04:10Z: Watching source directory changes...\n`}
                    </div>
                  </div>
                )}

                {/* 2. Users (Live CRM) */}
                {activeModule === 'users' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Users CRM</h3>
                        <p>Live accounts loaded directly from the application database.</p>
                      </div>
                    </div>

                    <div className="crm-table-container">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>User ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Account Type</th>
                            <th>Status</th>
                            <th>Compliance Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map(u => (
                            <tr key={u.id}>
                              <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>{u.id}</td>
                              <td>{u.name}</td>
                              <td>{u.email}</td>
                              <td>{u.role}</td>
                              <td>
                                <span style={{
                                  padding: '2px 6px',
                                  fontSize: '10px',
                                  borderRadius: '10px',
                                  backgroundColor: u.status === 'Active' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: u.status === 'Active' ? 'var(--accent-green)' : 'var(--accent-red)'
                                }}>
                                  {u.status}
                                </span>
                              </td>
                              <td>
                                <button className="crm-action-btn" onClick={() => exportUserData(u.id)}>
                                  <Download size={11} /> Export Data
                                </button>
                                <button className="crm-action-btn delete" onClick={() => deleteUserData(u.id)}>
                                  <Trash2 size={11} /> Right to be Forgotten
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. Support CRM */}
                {activeModule === 'support' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Support CRM</h3>
                        <p>Resolve customer complaints with agent-assisted database querying.</p>
                      </div>
                    </div>

                    <div className="support-grid">
                      <div className="ticket-list">
                        {tickets.map(t => (
                          <div 
                            key={t.id} 
                            className={`ticket-item ${selectedTicketId === t.id ? 'active' : ''}`}
                            onClick={() => setSelectedTicketId(t.id)}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4>{t.subject}</h4>
                              <span style={{
                                fontSize: '9px',
                                padding: '2px 4px',
                                borderRadius: '4px',
                                backgroundColor: t.priority === 'High' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                                color: t.priority === 'High' ? 'var(--accent-red)' : 'var(--text-secondary)'
                              }}>{t.priority}</span>
                            </div>
                            <p>{t.userEmail}</p>
                          </div>
                        ))}
                      </div>

                      <div className="ticket-detail">
                        {(() => {
                          const activeTicket = tickets.find(t => t.id === selectedTicketId);
                          if (!activeTicket) return <div style={{ padding: '20px' }}>Select a ticket</div>;

                          return (
                            <>
                              <div className="ticket-messages">
                                {activeTicket.messages.map((m, i) => (
                                  <div key={i} className={`ticket-msg ${m.sender}`}>
                                    {m.text}
                                  </div>
                                ))}
                              </div>

                              <div className="ticket-reply-box">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Draft Reply Email</span>
                                  <button className="action-btn" onClick={requestDraftAssist}>
                                    🪄 Agent Draft Assist
                                  </button>
                                </div>
                                <textarea 
                                  className="ticket-reply-textarea"
                                  placeholder="Type reply or click Agent Draft Assist to generate one..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                />
                                <div className="ticket-reply-actions">
                                  <button className="btn btn-primary" onClick={sendTicketReply}>
                                    Send Email Reply
                                  </button>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Analytics & Health */}
                {activeModule === 'analytics' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Analytics & Server Health</h3>
                        <p>Staging and production performance checks.</p>
                      </div>
                      {telemetry.isLeakActive && (
                        <button className="btn btn-primary" style={{ backgroundColor: 'var(--accent-orange)' }} onClick={triggerHotfix}>
                          ⚡ Apply Hotfix
                        </button>
                      )}
                    </div>

                    <div className="analytics-grid">
                      <div className="metric-card">
                        <h4>CPU Usage</h4>
                        <div className="value">{telemetry.cpuUsage}%</div>
                      </div>
                      <div className={`metric-card ${telemetry.isLeakActive ? 'alert' : ''}`}>
                        <h4>Memory Allocation</h4>
                        <div className="value">{telemetry.currentMemoryUsage}%</div>
                        {telemetry.isLeakActive && <div style={{ color: 'var(--accent-red)', fontSize: '10px', marginTop: '4px' }}>⚠️ Leak detected in websocket listener</div>}
                      </div>
                      <div className="metric-card">
                        <h4>Production Latency</h4>
                        <div className="value">{telemetry.latency}ms</div>
                      </div>
                      <div className="metric-card">
                        <h4>Daily Pageviews</h4>
                        <div className="value">{telemetry.pageViews}</div>
                      </div>
                    </div>

                    <h4 style={{ marginBottom: '8px' }}>Memory Allocation Timeline</h4>
                    <div className="chart-placeholder">
                      <svg width="100%" height="100px">
                        {/* Render simple mock metric line */}
                        <path 
                          d={telemetry.isLeakActive 
                            ? "M 10,80 L 100,75 L 200,60 L 300,50 L 400,30 L 500,20" 
                            : "M 10,80 L 100,75 L 200,78 L 300,75 L 400,74 L 500,75"
                          } 
                          fill="none" 
                          stroke={telemetry.isLeakActive ? 'var(--accent-red)' : 'var(--accent-green)'} 
                          strokeWidth="2" 
                        />
                      </svg>
                    </div>
                  </div>
                )}

                {/* 5. Marketing */}
                {activeModule === 'marketing' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Marketing & SEO</h3>
                        <p>Configure search tags and marketing campaigns.</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-card)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>SEO Page Title</label>
                        <input type="text" className="search-input" style={{ width: '100%' }} defaultValue="Bobbie Digital LLC | Custom Web Engineering" />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>SEO Meta Description</label>
                        <textarea className="ticket-reply-textarea" defaultValue="Bobbie Digital designs high-performance React solutions with cloud-based multi-agent integrations." />
                      </div>
                      <div>
                        <button className="btn btn-primary">Save SEO Settings</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Domains */}
                {activeModule === 'domains' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Domains configuration</h3>
                        <p>CNAME details and SSL authentication paths.</p>
                      </div>
                    </div>

                    <div className="crm-table-container">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Domain</th>
                            <th>Redirect Target</th>
                            <th>SSL Status</th>
                            <th>Cloudflare Routing</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>bobbiedigital.com</td>
                            <td>Primary</td>
                            <td><span style={{ color: 'var(--accent-green)' }}>Active (AutoRenew)</span></td>
                            <td>Enabled</td>
                          </tr>
                          <tr>
                            <td>www.bobbiedigital.com</td>
                            <td>bobbiedigital.com</td>
                            <td><span style={{ color: 'var(--accent-green)' }}>Active</span></td>
                            <td>Enabled</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 7. Integrations */}
                {activeModule === 'integrations' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>MCP Server Connectors</h3>
                        <p>Equip agents with file system access, terminal execution, and database triggers.</p>
                      </div>
                    </div>

                    <div className="crm-table-container">
                      <table className="crm-table">
                        <thead>
                          <tr>
                            <th>Connector Name</th>
                            <th>Protocol Type</th>
                            <th>Internal Port</th>
                            <th>Connection Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {mcpIntegrations.map((mcp, i) => (
                            <tr key={i}>
                              <td style={{ fontWeight: 500 }}>{mcp.name}</td>
                              <td>{mcp.type}</td>
                              <td>{mcp.port}</td>
                              <td>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  backgroundColor: mcp.status === 'Connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                                  color: mcp.status === 'Connected' ? 'var(--accent-green)' : 'var(--text-secondary)'
                                }}>
                                  {mcp.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 8. Security */}
                {activeModule === 'security' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Security & Packages Audit</h3>
                        <p>Active firewall blocks, SSL checks, and package vulnerabilities.</p>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                      <div className="metric-card">
                        <h4>Blocked Firewall Requests</h4>
                        <div className="value">12</div>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>IP scan frequency: 10s</p>
                      </div>
                      <div className="metric-card">
                        <h4>Security Audit</h4>
                        <div className="value" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontSize: '16px', marginTop: '12px' }}>
                          <CheckCircle size={18} /> 0 Vulnerabilities Detected
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 9. Code & Git */}
                {activeModule === 'code' && (
                  <div>
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Code Sandbox</h3>
                        <p>Explore workspace file contents and active git differences.</p>
                      </div>
                    </div>

                    <div className="code-grid">
                      <div className="code-tree">
                        <div className={`tree-item ${selectedFile === 'src/App.tsx' ? 'active' : ''}`} onClick={() => setSelectedFile('src/App.tsx')}>
                          <FileCode size={13} /> src/App.tsx
                        </div>
                        <div className={`tree-item ${selectedFile === 'src/server.ts' ? 'active' : ''}`} onClick={() => setSelectedFile('src/server.ts')}>
                          <FileCode size={13} /> src/server.ts
                        </div>
                        <div className={`tree-item ${selectedFile === 'package.json' ? 'active' : ''}`} onClick={() => setSelectedFile('package.json')}>
                          <FileCode size={13} /> package.json
                        </div>
                        <div className={`tree-item ${selectedFile === 'git diff' ? 'active' : ''}`} onClick={() => setSelectedFile('git diff')}>
                          <ShieldAlert size={13} /> Git Diff
                        </div>
                      </div>

                      <div className="code-viewer">
                        <pre>{fileContents[selectedFile]}</pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* 10. Agents (Visualizer) */}
                {activeModule === 'agents' && (
                  <div className="agent-visualizer-container">
                    <div className="section-header">
                      <div className="section-title">
                        <h3>Agent Task & Visualizer Panel</h3>
                        <p>Observe state sharing on the event bus blackboard.</p>
                      </div>
                    </div>

                    <div className="visualizer-panel">
                      <div className="agent-graph">
                        <div className="reactflow-wrapper" style={{ height: 220 }}>
                          <ReactFlowProvider>
                            <ReactFlow nodes={rfNodes} edges={rfEdges} onNodeClick={(_, node) => openInspectorForNode(node as Node)}>
                              <Background gap={12} />
                              <Controls />
                              <MiniMap />
                            </ReactFlow>
                          </ReactFlowProvider>
                        </div>
                        <svg className="graph-svg-lines">
                          <line x1="20%" y1="50%" x2="50%" y2="50%" stroke="var(--border-color)" strokeWidth="2" />
                          <line x1="50%" y1="50%" x2="80%" y2="50%" stroke="var(--border-color)" strokeWidth="2" />
                        </svg>

                        <div className={`agent-node ${getActiveAgentName() === 'Main Bot' ? 'active' : ''}`}>
                          <div className="agent-avatar" style={{ backgroundColor: 'var(--accent-purple)' }}>
                            <Workflow />
                          </div>
                          <span className="agent-node-title">Main Bot</span>
                          <span className="agent-node-status">{getActiveAgentName() === 'Main Bot' ? 'ACTIVE' : 'IDLE'}</span>
                        </div>

                        <div className={`agent-node ${getActiveAgentName() === 'Scaffold Agent' || getActiveAgentName() === 'Coder Agent' ? 'active' : ''}`}>
                          <div className="agent-avatar" style={{ backgroundColor: 'var(--accent-orange)' }}>
                            <Code />
                          </div>
                          <span className="agent-node-title">Coder / Scaffold</span>
                          <span className="agent-node-status">{getActiveAgentName() === 'Scaffold Agent' || getActiveAgentName() === 'Coder Agent' ? 'ACTIVE' : 'IDLE'}</span>
                        </div>

                        <div className={`agent-node ${getActiveAgentName() === 'Support Agent' ? 'active' : ''}`}>
                          <div className="agent-avatar" style={{ backgroundColor: 'var(--accent-blue)' }}>
                            <LifeBuoy />
                          </div>
                          <span className="agent-node-title">Support Agent</span>
                          <span className="agent-node-status">{getActiveAgentName() === 'Support Agent' ? 'ACTIVE' : 'IDLE'}</span>
                        </div>
                      </div>

                      <h4 style={{ marginBottom: '8px' }}>Blackboard Chronicles (Timeline)</h4>
                      <div className="sequence-timeline">
                        {eventLogs.map((log) => (
                          <div key={log.eventId} className={`sequence-step ${log.status === 'COMPLETED' ? 'completed' : 'active'}`} onClick={() => openInspectorForEvent(log)}>
                            <h5>{log.sender} ➔ {log.receiver} <span className="time">{new Date(log.timestamp).toLocaleTimeString()}</span></h5>
                            <p>{log.message} (Status: {log.status})</p>
                          </div>
                        ))}
                      </div>

                      <h4 style={{ marginTop: '20px', marginBottom: '8px' }}>Raw Blackboard JSON Event Feed</h4>
                      <div className="blackboard-log-output">
                        {JSON.stringify(eventLogs, null, 2)}
                      </div>

                      <div className="huggingface-agent-panel" style={{ marginTop: '24px' }}>
                        <div className="section-header">
                          <div className="section-title">
                            <h3>Hugging Face Agent Browser</h3>
                            <p>Search and download agent models from Hugging Face into the local workspace.</p>
                          </div>
                        </div>

                        <div className="hf-search-row" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
                          <input
                            type="text"
                            className="search-input"
                            value={hfSearchTerm}
                            onChange={(e) => setHfSearchTerm(e.target.value)}
                            placeholder="Search Hugging Face agents..."
                            style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--panel-bg)' }}
                          />
                          <button className="action-btn" type="button" onClick={() => fetchHuggingFaceModels(hfSearchTerm)}>
                            <Search /> Search
                          </button>
                        </div>

                        {hfLoading && <div className="status-message">Loading models...</div>}
                        {hfError && <div className="status-message error">{hfError}</div>}
                        {hfDownloadMessage && <div className="status-message">{hfDownloadMessage}</div>}

                        <div className="hf-model-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '14px' }}>
                          {huggingFaceModels.map((model) => (
                            <div key={model.id} className="hf-model-card" style={{ border: '1px solid var(--border-color)', borderRadius: '14px', padding: '16px', background: 'var(--panel-bg)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                <div>
                                  <h5 style={{ margin: 0 }}>{model.id}</h5>
                                  <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '12px' }}>by {model.author}</p>
                                </div>
                                <Download size={18} />
                              </div>
                              <p style={{ margin: '10px 0 0', fontSize: '13px', minHeight: '46px', color: 'var(--text-muted)' }}>
                                {model.description || model.pipeline_tag || 'No description provided.'}
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{model.downloads.toLocaleString()} downloads</span>
                                <button className="btn btn-primary" type="button" onClick={() => downloadHuggingFaceAgentModel(model.id)}>
                                  Download
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Compliance / Cookie tracker consent banner */}
      {showCookieBanner && (
        <div className="cookie-banner">
          <div className="cookie-content">
            <h4>Cookie & Tracker Preferences</h4>
            <p>
              We use telemetry data to analyze site performance, router loads, and support agent draft assistance. 
              Review and customize your options to consent. Read our <span style={{ color: 'var(--accent-purple)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setShowPrivacyModal(true)}>Privacy Policy</span>.
            </p>
          </div>
          
          {showCookieSettings && (
            <div className="cookie-options">
              <label className="cookie-option">
                <input 
                  type="checkbox" 
                  checked={cookiePreferences.essential} 
                  disabled 
                  onChange={() => {}} 
                />
                Essential Cookies
              </label>
              <label className="cookie-option">
                <input 
                  type="checkbox" 
                  checked={cookiePreferences.analytics} 
                  onChange={(e) => setCookiePreferences(prev => ({ ...prev, analytics: e.target.checked }))} 
                />
                Analytics Telemetry
              </label>
              <label className="cookie-option">
                <input 
                  type="checkbox" 
                  checked={cookiePreferences.marketing} 
                  onChange={(e) => setCookiePreferences(prev => ({ ...prev, marketing: e.target.checked }))} 
                />
                Marketing Toggles
              </label>
            </div>
          )}

          <div className="cookie-actions">
            <button className="btn btn-secondary" onClick={() => setShowCookieSettings(!showCookieSettings)}>
              {showCookieSettings ? 'Hide Options' : 'Customise'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowCookieBanner(false)}>
              Decline
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                setShowCookieBanner(false);
                console.log('Saved cookie consent preferences:', cookiePreferences);
              }}
            >
              Accept Selection
            </button>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="modal-overlay" onClick={() => setShowPrivacyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>GDPR & CCPA Privacy Policy</h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowPrivacyModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>Last updated: June 21, 2026</p>
              <h4>1. Data Collection & Processing</h4>
              <p>
                Omnigent acts as an application deployment portal. We collect system metrics, live connection status data, and user profile properties inside staging applications. 
              </p>
              <h4>2. Routing to Third-Party LLM Endpoints</h4>
              <p>
                To provide conversational AI features, agent drafts, and code parsing, we route logs and inputs through secure cloud endpoints (Google Gemini, Anthropic Claude). No personal identifiable information is shared without user-initiated support requests.
              </p>
              <h4>3. Data Access & Portability</h4>
              <p>
                In compliance with GDPR and CCPA, users have the Right to Portability (exporting data in readable JSON formats) and the Right to be Forgotten (deleting directories and profiles). Users can trigger these actions directly from the live CRM view in the dashboard.
              </p>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setShowPrivacyModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="modal-overlay" onClick={() => setShowTermsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Terms of Service (ToS)</h3>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setShowTermsModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>Welcome to Omnigent. By accessing this platform, you agree to these conditions.</p>
              <h4>1. Workspace Scaffolding License</h4>
              <p>
                All template files, boileplate codes, and agent runner frameworks generated are licensed to Bobbie Digital LLC and the specific client entities under custom service level agreements.
              </p>
              <h4>2. Telemetry and Compliance Tools</h4>
              <p>
                We provide visual indicators of system health, databases, and GDPR utilities. However, sandbox isolation and network access configurations remain the responsibility of the system administrator.
              </p>
            </div>
            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setShowTermsModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {inspectorOpen && (
        <div className="drawer-overlay" onClick={() => setInspectorOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h4>Inspector</h4>
              <button className="btn" onClick={() => setInspectorOpen(false)}><X size={16} /></button>
            </div>
            <div className="drawer-body">
              {inspectorData ? (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(inspectorData, null, 2)}</pre>
              ) : (
                <div>No inspector data</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
