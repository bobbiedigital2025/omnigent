import { useState, useEffect, useRef } from 'react';
import { 
  Send, Activity, Mail, Database, TrendingUp, Globe, 
  Settings, Shield, Code, Share2, 
  CheckCircle, Play, Download, Trash2, Cpu, Info 
} from 'lucide-react';
import './App.css';

interface Message {
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

function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'preview' | 'dashboard'>('dashboard');
  const [activeMenu, setActiveMenu] = useState<string>('agents');
  const [cookieConsent, setCookieConsent] = useState<boolean>(true);

  // Chat States
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'agent',
      text: "Hello! I am Omnigent, your Main Agent. I am here to help you develop, monitor, and maintain your software apps. How can I help Bobbie Digital LLC today?",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // DB CRM mock data
  const [crmSearch, setCrmSearch] = useState('');
  const [crmUsers, setCrmUsers] = useState([
    { id: 'usr_001', name: 'John Doe', email: 'john@example.com', plan: 'Enterprise', created: '2026-06-15' },
    { id: 'usr_002', name: 'Jane Smith', email: 'jane@example.com', plan: 'Free', created: '2026-06-18' },
    { id: 'usr_003', name: 'Alex Johnson', email: 'alex.j@company.com', plan: 'Pro', created: '2026-06-20' },
  ]);

  // Support mock data
  const [selectedTicket, setSelectedTicket] = useState<string>('t_001');
  const [supportDraft, setSupportDraft] = useState('');
  const [supportTickets] = useState([
    { id: 't_001', user: 'John Doe', email: 'john@example.com', subject: 'Error loading invoice PDF', status: 'Open', body: 'Hi support team, I got a database transaction timeout warning when trying to download my last payment receipt. Can you please check?' },
    { id: 't_002', user: 'Jane Smith', email: 'jane@example.com', subject: 'Need to add custom domain', status: 'Closed', body: 'How do I add support@mydomain.com and point DNS nameservers to Omnigent host?' }
  ]);

  // Health and simulation states
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'warning'>('healthy');
  const [cpuUsage, setCpuUsage] = useState(12);
  const [ramUsage] = useState(38);
  const [logs, setLogs] = useState<string[]>([
    '[System] Server started on port 3000',
    '[System] Database SQLite initialized',
    '[System] Webhook connection status: OK'
  ]);

  // WebSocket Event Bus States
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [eventLogs, setEventLogs] = useState<EventMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket Server (Blackboard Event Bus)
  useEffect(() => {
    setWsStatus('connecting');
    const socket = new WebSocket('ws://localhost:3000');
    wsRef.current = socket;

    socket.onopen = () => {
      setWsStatus('connected');
      console.log('Connected to Event Bus');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'SYNC_HISTORY') {
          setEventLogs(data.payload);
        } else if (data.type === 'BLACKBOARD_EVENT') {
          setEventLogs((prev) => [...prev, data.payload]);
        }
      } catch (err) {
        console.error('Error parsing WebSocket event:', err);
      }
    };

    socket.onclose = () => {
      setWsStatus('disconnected');
      console.log('Disconnected from Event Bus');
    };

    return () => {
      socket.close();
    };
  }, []);

  // MCP states & effect
  const [mcpTools, setMcpTools] = useState<Array<{ serverName: string; tool: any }>>([]);
  const [loadingTools, setLoadingTools] = useState<boolean>(false);

  useEffect(() => {
    if (activeMenu === 'integrations') {
      setLoadingTools(true);
      fetch('http://localhost:3000/api/mcp/tools')
        .then((res) => res.json())
        .then((data) => {
          setMcpTools(data.tools || []);
          setLoadingTools(false);
        })
        .catch((err) => {
          console.error('Failed to fetch MCP tools:', err);
          setLoadingTools(false);
        });
    }
  }, [activeMenu]);

  // Send message to main agent
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    const promptText = chatInput;
    setChatInput('');

    const taskId = 'tsk_' + Date.now().toString().slice(-4);

    // If WebSocket is connected, route to the backend agent runner
    if (wsStatus === 'connected' && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      postEvent(taskId, 'main_bot', 'blackboard', 'PENDING', `Omnigent parsed task: "${promptText}"`);
      
      const lower = promptText.toLowerCase();
      let targetAgent = 'coder_agent';
      if (lower.includes('script') || lower.includes('screenplay') || lower.includes('fountain') || lower.includes('shot list') || lower.includes('film') || lower.includes('movie') || lower.includes('scene')) {
        targetAgent = 'script_agent';
      } else if (lower.includes('grafana') || lower.includes('telemetry') || lower.includes('gpu') || lower.includes('render') || lower.includes('ops') || lower.includes('cost') || lower.includes('alert')) {
        targetAgent = 'studio_ops_agent';
      } else if (lower.includes('security') || lower.includes('audit')) {
        targetAgent = 'security_agent';
      }

      wsRef.current.send(JSON.stringify({
        type: 'NEW_TASK',
        payload: {
          taskId,
          assignedTo: targetAgent,
          description: promptText
        }
      }));

      // Acknowledge routing
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: 'agent',
            text: `Task routed to the Event Bus. The background agents are executing it now. Watch their progress on the 'Agents Visualizer' dashboard.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }, 1000);
      return;
    }

    // Fallback: Trigger mock background event cycles to simulate agent teamwork offline
    const mockAgentWorkflow = async () => {
      // 1. Post Event: Task Created
      postEvent(taskId, 'main_bot', 'blackboard', 'PENDING', `Omnigent parsed task: "${promptText}"`);
      
      // Response delay simulating agent processing
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      if (promptText.toLowerCase().includes('scaffold') || promptText.toLowerCase().includes('create')) {
        postEvent(taskId, 'scaffold_agent', 'blackboard', 'IN_PROGRESS', 'Initializing local workspace directory structure...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        postEvent(taskId, 'scaffold_agent', 'blackboard', 'COMPLETED', 'Successfully scaffolded new app templates inside /client and /server');
      } else if (promptText.toLowerCase().includes('support') || promptText.toLowerCase().includes('draft')) {
        postEvent(taskId, 'support_agent', 'blackboard', 'IN_PROGRESS', 'Analyzing user database record and checking health logs...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        postEvent(taskId, 'support_agent', 'blackboard', 'COMPLETED', 'Support agent loaded database details and compiled draft reply.');
      } else {
        postEvent(taskId, 'coder_agent', 'blackboard', 'IN_PROGRESS', 'Refactoring application controller endpoints and linting code...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        postEvent(taskId, 'coder_agent', 'blackboard', 'COMPLETED', 'Changes saved. Successfully updated file tree changes and verified tests.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: 'agent',
          text: `Task completed. I guided the background agents to solve it. You can see the step-by-step execution timeline in the Developer Dashboard under the 'Agents' panel.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    };

    mockAgentWorkflow();
  };

  const postEvent = (taskId: string, sender: string, receiver: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED', msg: string) => {
    const newEvent: EventMessage = {
      eventId: 'evt_' + Math.random().toString(36).slice(2, 8),
      taskId,
      timestamp: new Date().toLocaleTimeString(),
      sender,
      receiver,
      status,
      message: msg
    };

    // Push local
    setEventLogs((prev) => [...prev, newEvent]);

    // Push to server over WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'BLACKBOARD_EVENT',
        payload: newEvent
      }));
    }
  };

  // Support ticket drafting helper
  const handleAutoDraft = () => {
    const currentTicket = supportTickets.find((t) => t.id === selectedTicket);
    if (!currentTicket) return;

    setSupportDraft(
      `Hi ${currentTicket.user},\n\nI investigated your recent activity logs and order history. The server timed out due to a connection lock, but we have processed your order manually. The PDF receipt is now accessible in your profile account. Let us know if you need anything else!\n\nBest regards,\nSupport Bot | Bobbie Digital LLC`
    );
  };

  // Health event simulation
  const handleSimulateError = () => {
    setHealthStatus('warning');
    setCpuUsage(94);
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] WARNING: DB Connection Pool capacity exceeded (98/100)`,
      `[${new Date().toLocaleTimeString()}] ERROR: 504 Gateway Timeout on /api/v1/payments/invoice`
    ]);

    // Trigger agent hotfix recommendation
    setTimeout(() => {
      setLogs((prev) => [
        ...prev,
        `[Agent AI] Analyzed trace: connection leak located in checkout controller.`,
        `[Agent AI] Auto-Fix Available: Apply patch config to expand DB connection pool limits.`
      ]);
    }, 2000);
  };

  const handleApplyHotfix = () => {
    setHealthStatus('healthy');
    setCpuUsage(14);
    setLogs((prev) => [
      ...prev,
      `[Agent AI] Hotfix successfully deployed.`,
      `[System] Connection Pool reallocated (150 max). Database connections restored.`
    ]);
  };

  // GDPR data delete CRM action
  const handleDeleteUser = (id: string) => {
    setCrmUsers((prev) => prev.filter((u) => u.id !== id));
    setLogs((prev) => [
      ...prev,
      `[Compliance] GDPR Deletion Request fulfilled: Removed user account '${id}' permanently from local database storage.`
    ]);
  };

  // GDPR data download action
  const handleDownloadUserData = (user: any) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(user, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `gdpr_export_${user.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="app-container">
      {/* 1. Left Panel - Chat */}
      <div className="chat-panel">
        <div className="header-container">
          <div className="logo-text">
            <Activity size={24} className="dashed-line" />
            <span>Omnigent</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>WS Status:</span>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: wsStatus === 'connected' ? '#10b981' : wsStatus === 'connecting' ? '#f59e0b' : '#ef4444' 
            }} />
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((m) => (
            <div key={m.id} className={`message-bubble ${m.sender}`}>
              <div style={{ fontSize: '12px', color: m.sender === 'user' ? '#ddd' : '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>
                {m.sender === 'user' ? 'Developer' : 'Omnigent (Main)'}
              </div>
              <div>{m.text}</div>
              <div style={{ fontSize: '9px', textAlign: 'right', marginTop: '4px', opacity: 0.7 }}>{m.time}</div>
            </div>
          ))}
        </div>

        <div className="chat-input-area">
          <input 
            type="text" 
            className="chat-input" 
            placeholder="Ask Omnigent to build, test or run code..." 
            value={chatInput} 
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button className="chat-send-btn" onClick={handleSendMessage}>
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* 2. Right Panel - Workspace */}
      <div className="workspace-panel">
        <div className="workspace-tabs">
          <button 
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Play size={16} />
            <span>App Preview</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Globe size={16} />
            <span>Developer Dashboard</span>
          </button>
        </div>

        <div className="workspace-content">
          {activeTab === 'preview' ? (
            /* Live App Preview Rendering Mockup */
            <div style={{ padding: '40px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1e293b' }}>
              <div style={{ backgroundColor: '#0f172a', padding: '32px', borderRadius: '12px', border: '1px solid #374151', width: '100%', maxWidth: '500px', textAlign: 'center' }}>
                <CheckCircle size={48} color="#10b981" style={{ marginBottom: '16px' }} />
                <h2 style={{ margin: '0 0 8px', fontSize: '22px' }}>Staging Environment Online</h2>
                <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>
                  Your live Hot-Reload preview is active on port 5173.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', fontSize: '13px', color: '#8b5cf6', fontWeight: 600 }}>
                  <Globe size={16} />
                  <span>https://staging-client-project.local</span>
                </div>
              </div>
            </div>
          ) : (
            /* Developer Dashboard Control Center */
            <div className="dashboard-layout">
              {/* Sidebar Navigation */}
              <div className="dashboard-sidebar">
                <button className={`sidebar-item ${activeMenu === 'overview' ? 'active' : ''}`} onClick={() => setActiveMenu('overview')}>
                  <Globe size={16} /> App Overview
                </button>
                <button className={`sidebar-item ${activeMenu === 'users' ? 'active' : ''}`} onClick={() => setActiveMenu('users')}>
                  <Database size={16} /> Users (Live CRM)
                </button>
                <button className={`sidebar-item ${activeMenu === 'support' ? 'active' : ''}`} onClick={() => setActiveMenu('support')}>
                  <Mail size={16} /> Support (Ticket CRM)
                </button>
                <button className={`sidebar-item ${activeMenu === 'analytics' ? 'active' : ''}`} onClick={() => setActiveMenu('analytics')}>
                  <Activity size={16} /> Analytics & Health
                </button>
                <button className={`sidebar-item ${activeMenu === 'marketing' ? 'active' : ''}`} onClick={() => setActiveMenu('marketing')}>
                  <TrendingUp size={16} /> Marketing
                </button>
                <button className={`sidebar-item ${activeMenu === 'domains' ? 'active' : ''}`} onClick={() => setActiveMenu('domains')}>
                  <Globe size={16} /> Domains
                </button>
                <button className={`sidebar-item ${activeMenu === 'integrations' ? 'active' : ''}`} onClick={() => setActiveMenu('integrations')}>
                  <Settings size={16} /> Integrations (MCP)
                </button>
                <button className={`sidebar-item ${activeMenu === 'security' ? 'active' : ''}`} onClick={() => setActiveMenu('security')}>
                  <Shield size={16} /> Security
                </button>
                <button className={`sidebar-item ${activeMenu === 'code' ? 'active' : ''}`} onClick={() => setActiveMenu('code')}>
                  <Code size={16} /> Code Explorer
                </button>
                <button className={`sidebar-item ${activeMenu === 'agents' ? 'active' : ''}`} onClick={() => setActiveMenu('agents')}>
                  <Share2 size={16} /> Agents Visualizer
                </button>
              </div>

              {/* Main Dashboard Screen Viewports */}
              <div className="dashboard-body">
                {activeMenu === 'overview' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>App Overview</h2>
                    <div className="metrics-grid">
                      <div className="metric-card">
                        <h3>Status</h3>
                        <div className="value" style={{ color: '#10b981' }}>Staging</div>
                      </div>
                      <div className="metric-card">
                        <h3>Github Connected</h3>
                        <div className="value" style={{ fontSize: '16px', textOverflow: 'ellipsis', overflow: 'hidden' }}>bobbiedigital2025/omnigent</div>
                      </div>
                      <div className="metric-card">
                        <h3>Last Build</h3>
                        <div className="value" style={{ fontSize: '18px' }}>Passed (10m ago)</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeMenu === 'users' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '24px' }}>Users (Live CRM Mode)</h2>
                      <input 
                        type="text" 
                        placeholder="Search users..." 
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        value={crmSearch} 
                        onChange={(e) => setCrmSearch(e.target.value)}
                      />
                    </div>
                    <p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 16px' }}>
                      <Info size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                      GDPR and CCPA Compliant CRM. You can download details or purge data profiles instantly.
                    </p>
                    <table className="crm-table">
                      <thead>
                        <tr>
                          <th>User ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Plan</th>
                          <th>Sign Up</th>
                          <th>Compliance Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {crmUsers.filter(u => u.name.toLowerCase().includes(crmSearch.toLowerCase())).map((u) => (
                          <tr key={u.id}>
                            <td><code>{u.id}</code></td>
                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                            <td>{u.email}</td>
                            <td><span className="badge active">{u.plan}</span></td>
                            <td>{u.created}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button title="Download User Data (GDPR Export)" onClick={() => handleDownloadUserData(u)} style={{ background: '#374151', padding: '6px', borderRadius: '4px', color: '#fff' }}>
                                  <Download size={14} />
                                </button>
                                <button title="Delete User Permanently" onClick={() => handleDeleteUser(u.id)} style={{ background: '#ef4444', padding: '6px', borderRadius: '4px', color: '#fff' }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeMenu === 'support' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>Support Ticket CRM</h2>
                    <div style={{ display: 'flex', gap: '20px', height: '400px' }}>
                      {/* List */}
                      <div style={{ width: '40%', border: '1px solid #374151', borderRadius: '6px', overflowY: 'auto' }}>
                        {supportTickets.map((t) => (
                          <div 
                            key={t.id} 
                            onClick={() => setSelectedTicket(t.id)}
                            style={{ 
                              padding: '12px', 
                              borderBottom: '1px solid #374151', 
                              cursor: 'pointer',
                              backgroundColor: selectedTicket === t.id ? '#1f2937' : 'transparent'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>{t.user}</span>
                              <span className="badge active">{t.status}</span>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#f3f4f6', marginBottom: '2px' }}>{t.subject}</div>
                            <div style={{ fontSize: '11px', color: '#9ca3af', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{t.body}</div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Ticket Body & Agent Draft */}
                      <div style={{ width: '60%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {supportTickets.filter(t => t.id === selectedTicket).map((t) => (
                          <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ border: '1px solid #374151', padding: '16px', borderRadius: '6px', backgroundColor: '#0f172a', fontSize: '13px' }}>
                              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px' }}>From: {t.user} ({t.email})</div>
                              <div style={{ borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '8px', fontWeight: 600 }}>Subject: {t.subject}</div>
                              <div style={{ whiteSpace: 'pre-wrap', color: '#d1d5db' }}>{t.body}</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af' }}>Compose Draft Reply:</label>
                                <button onClick={handleAutoDraft} style={{ backgroundColor: '#8b5cf6', color: '#fff', fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                  Auto-Draft with Agent Context
                                </button>
                              </div>
                              <textarea 
                                rows={6} 
                                style={{ padding: '12px', fontSize: '13px', width: '100%', resize: 'none' }}
                                value={supportDraft}
                                onChange={(e) => setSupportDraft(e.target.value)}
                                placeholder="Type support reply or click Auto-Draft to query logs..."
                              />
                              <button style={{ backgroundColor: '#10b981', color: '#fff', padding: '8px', borderRadius: '6px', fontWeight: 600 }}>
                                Send Reply Email
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeMenu === 'analytics' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h2 style={{ margin: 0, fontSize: '24px' }}>Analytics & System Health</h2>
                      {healthStatus === 'warning' ? (
                        <button onClick={handleApplyHotfix} style={{ backgroundColor: '#10b981', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontWeight: 600 }}>
                          Apply AI Hotfix (Database Patch)
                        </button>
                      ) : (
                        <button onClick={handleSimulateError} style={{ backgroundColor: '#ef4444', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontWeight: 600 }}>
                          Simulate Server Crash
                        </button>
                      )}
                    </div>

                    <div className="metrics-grid">
                      <div className="metric-card" style={{ borderLeft: healthStatus === 'warning' ? '4px solid #ef4444' : '1px solid #374151' }}>
                        <h3>CPU Diagnostics</h3>
                        <div className="value">{cpuUsage}%</div>
                      </div>
                      <div className="metric-card">
                        <h3>RAM Allocation</h3>
                        <div className="value">{ramUsage}%</div>
                      </div>
                      <div className="metric-card">
                        <h3>Active DB Conns</h3>
                        <div className="value">{healthStatus === 'warning' ? '98 / 100' : '12 / 150'}</div>
                      </div>
                    </div>

                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '8px' }}>Live Server Log Streams:</label>
                    <div className="log-terminal">
                      {logs.map((log, i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>{log}</div>
                      ))}
                    </div>
                  </div>
                )}

                {activeMenu === 'marketing' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>Marketing & SEO Dashboard</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '500px' }}>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Google Meta Title Tag:</label>
                        <input type="text" style={{ width: '100%', padding: '8px 12px' }} defaultValue="Omnigent - Automated Application Builder & Agency Hub" />
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Meta Keywords (Comma separated):</label>
                        <input type="text" style={{ width: '100%', padding: '8px 12px' }} defaultValue="ai coding agent, software agency automation, multi-agent react framework" />
                      </div>
                      <div>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af', display: 'block', marginBottom: '6px' }}>Email Marketing Campaign Setup:</label>
                        <select style={{ width: '100%', padding: '8px 12px' }}>
                          <option>Welcome Onboarding Sequence</option>
                          <option>Developer Newsletter Weekly</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {activeMenu === 'domains' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>Custom Domain Configuration</h2>
                    <div style={{ border: '1px solid #374151', padding: '16px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>https://omnigent.bobbiedigital.com</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>DNS Target: `cname.bobbiedigitalhub.net` | SSL: Active</div>
                      </div>
                      <span className="badge active" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>Live</span>
                    </div>
                  </div>
                )}

                {activeMenu === 'integrations' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>Model Context Protocol (MCP) Integrations</h2>
                    
                    {loadingTools ? (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
                        <Cpu className="dashed-line" size={32} style={{ margin: '0 auto 12px', display: 'block' }} />
                        <span>Discovering active MCP servers and tools...</span>
                      </div>
                    ) : mcpTools.length === 0 ? (
                      <div>
                        <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#ef4444', fontSize: '13px' }}>
                          ⚠️ Event Bus Server is offline or no MCP servers are configured in <code>mcp-config.json</code>. Showing mock integrations.
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ border: '1px solid #374151', padding: '16px', borderRadius: '6px', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>Local FileSystem MCP Server</div>
                              <div style={{ fontSize: '12px', color: '#9ca3af' }}>Provides read/write access to folder trees.</div>
                            </div>
                            <span className="badge active">Mocked</span>
                          </div>
                          <div style={{ border: '1px solid #374151', padding: '16px', borderRadius: '6px', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '14px' }}>Sqlite Schema Discovery MCP</div>
                              <div style={{ fontSize: '12px', color: '#9ca3af' }}>Enables SQL schema inspection & data queries.</div>
                            </div>
                            <span className="badge active">Mocked</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Group tools by serverName */}
                        {Array.from(new Set(mcpTools.map(t => t.serverName))).map(server => {
                          const serverTools = mcpTools.filter(t => t.serverName === server);
                          return (
                            <div key={server} style={{ border: '1px solid #374151', borderRadius: '6px', backgroundColor: '#0f172a', overflow: 'hidden' }}>
                              <div style={{ padding: '12px 16px', backgroundColor: '#1e293b', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Cpu size={16} color="#8b5cf6" />
                                  <span style={{ fontWeight: 600, fontSize: '15px', color: '#fff' }}>{server.toUpperCase()} MCP Server</span>
                                </div>
                                <span className="badge active" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>Connected</span>
                              </div>
                              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: '#9ca3af', marginBottom: '4px' }}>Exposed Tools ({serverTools.length}):</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                  {serverTools.map(({ tool }) => (
                                    <div key={tool.name} style={{ border: '1px solid #1e293b', padding: '10px 12px', borderRadius: '4px', backgroundColor: '#020617' }}>
                                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#f3f4f6', fontFamily: 'monospace' }}>{tool.name}()</div>
                                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px', minHeight: '28px' }}>{tool.description || 'No description provided.'}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeMenu === 'security' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>Security & Audit Settings</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ border: '1px solid #374151', padding: '16px', borderRadius: '6px', backgroundColor: '#0f172a' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px' }}>API Endpoint Firewall</span>
                          <span className="badge active">Active</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>IP Rate limits configured: 100 requests per minute from user agents.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeMenu === 'code' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>Code Explorer</h2>
                    <div style={{ display: 'flex', border: '1px solid #374151', borderRadius: '6px', height: '350px' }}>
                      {/* File Tree */}
                      <div style={{ width: '30%', borderRight: '1px solid #374151', padding: '12px', backgroundColor: '#0f172a', overflowY: 'auto', fontSize: '13px' }}>
                        <div style={{ fontWeight: 600, color: '#8b5cf6', marginBottom: '8px' }}>workspace-root/</div>
                        <div style={{ paddingLeft: '12px', color: '#9ca3af' }}>📁 client/</div>
                        <div style={{ paddingLeft: '24px', color: '#d1d5db' }}>index.html</div>
                        <div style={{ paddingLeft: '24px', color: '#d1d5db' }}>package.json</div>
                        <div style={{ paddingLeft: '24px', color: '#d1d5db' }}>src/App.tsx</div>
                        <div style={{ paddingLeft: '12px', color: '#9ca3af' }}>📁 server/</div>
                        <div style={{ paddingLeft: '24px', color: '#d1d5db' }}>src/index.ts</div>
                        <div style={{ paddingLeft: '24px', color: '#d1d5db' }}>src/app.ts</div>
                      </div>
                      
                      {/* Editor Preview */}
                      <div style={{ width: '70%', padding: '16px', backgroundColor: '#020617', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px', color: '#cbd5e1' }}>
                        <div style={{ color: '#64748b', borderBottom: '1px solid #1e293b', paddingBottom: '4px', marginBottom: '8px' }}>// server/src/index.ts</div>
                        <div><span style={{ color: '#f43f5e' }}>import</span> http <span style={{ color: '#f43f5e' }}>from</span> <span style={{ color: '#10b981' }}>'http'</span>;</div>
                        <div><span style={{ color: '#f43f5e' }}>import</span> app, &#123; setupWebSocketServer &#125; <span style={{ color: '#f43f5e' }}>from</span> <span style={{ color: '#10b981' }}>'./app'</span>;</div>
                        <br />
                        <div><span style={{ color: '#f43f5e' }}>const</span> server = http.createServer(app);</div>
                        <div>setupWebSocketServer(server);</div>
                        <br />
                        <div>server.listen(3000, {"() => {"})</div>
                        <div style={{ paddingLeft: '16px' }}>console.log(<span style={{ color: '#10b981' }}>"Omnigent Event Bus online"</span>);</div>
                        <div>&#125;);</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeMenu === 'agents' && (
                  <div>
                    <h2 style={{ margin: '0 0 16px', fontSize: '24px' }}>Agents Handoff Visualizer</h2>
                    <div style={{ border: '1px solid #374151', padding: '16px', borderRadius: '6px', height: '350px', backgroundColor: '#0f172a', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #374151', paddingBottom: '8px', marginBottom: '16px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#9ca3af' }}>Background Agent Topology Graph</span>
                        <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#d1d5db' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }} /> Active
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '8px', height: '8px', backgroundColor: '#374151', borderRadius: '50%' }} /> Idle
                          </span>
                        </div>
                      </div>

                      {/* Custom Render of Handoff Graph */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        
                        {/* Hub Node */}
                        <div style={{ 
                          position: 'absolute', 
                          left: '50%', 
                          top: '50%', 
                          transform: 'translate(-50%, -50%)',
                          border: '2px solid #8b5cf6', 
                          padding: '12px 18px', 
                          borderRadius: '8px', 
                          backgroundColor: '#1f2937', 
                          textAlign: 'center',
                          zIndex: 10
                        }}>
                          <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 600 }}>ORCHESTRATOR</div>
                          <div style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>Main Agent</div>
                        </div>

                        {/* Top Node */}
                        <div style={{ 
                          position: 'absolute', 
                          left: '50%', 
                          top: '15%', 
                          transform: 'translateX(-50%)',
                          border: '1px solid #374151', 
                          padding: '8px 14px', 
                          borderRadius: '6px', 
                          backgroundColor: '#111827',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '9px', color: '#9ca3af' }}>TEMPLATES</div>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>Scaffold Agent</div>
                        </div>

                        {/* Bottom Node */}
                        <div style={{ 
                          position: 'absolute', 
                          left: '50%', 
                          bottom: '15%', 
                          transform: 'translateX(-50%)',
                          border: '1px solid #374151', 
                          padding: '8px 14px', 
                          borderRadius: '6px', 
                          backgroundColor: '#111827',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '9px', color: '#9ca3af' }}>CUSTOMER</div>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>Support Agent</div>
                        </div>

                        {/* Left Node */}
                        <div style={{ 
                          position: 'absolute', 
                          left: '15%', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          border: '1px solid #374151', 
                          padding: '8px 14px', 
                          borderRadius: '6px', 
                          backgroundColor: '#111827',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '9px', color: '#9ca3af' }}>WRITER</div>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>Coder Agent</div>
                        </div>

                        {/* Right Node */}
                        <div style={{ 
                          position: 'absolute', 
                          right: '15%', 
                          top: '50%', 
                          transform: 'translateY(-50%)',
                          border: '1px solid #374151', 
                          padding: '8px 14px', 
                          borderRadius: '6px', 
                          backgroundColor: '#111827',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '9px', color: '#9ca3af' }}>VERIFIER</div>
                          <div style={{ fontWeight: 600, fontSize: '12px' }}>Linter Agent</div>
                        </div>

                        {/* Connective SVG lines */}
                        <svg style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, pointerEvents: 'none' }}>
                          {/* Main -> Scaffold (Top) */}
                          <line x1="50%" y1="50%" x2="50%" y2="25%" stroke="#374151" strokeWidth="2" className="dashed-line" />
                          {/* Main -> Support (Bottom) */}
                          <line x1="50%" y1="50%" x2="50%" y2="75%" stroke="#374151" strokeWidth="2" />
                          {/* Main -> Coder (Left) */}
                          <line x1="50%" y1="50%" x2="25%" y2="50%" stroke="#374151" strokeWidth="2" />
                          {/* Main -> Linter (Right) */}
                          <line x1="50%" y1="50%" x2="75%" y2="50%" stroke="#374151" strokeWidth="2" />
                        </svg>

                      </div>

                      {/* Event Log Output */}
                      <div style={{ borderTop: '1px solid #374151', paddingTop: '10px', fontSize: '11px', color: '#9ca3af' }}>
                        <strong>Active Event Stream:</strong> {eventLogs.length > 0 ? eventLogs[eventLogs.length - 1].message : 'Event Bus listening for handoffs...'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Legal / Cookie Compliance Banner */}
      {cookieConsent && (
        <div className="compliance-banner">
          <div className="compliance-text">
            <span>
              This application is operated by <strong>Bobbie Digital LLC</strong>. We use cookies and process application code contexts (routed to secure LLM APIs) to analyze performance and auto-generate project configurations. By using our hub, you consent to our <a href="#privacy">Privacy Policy</a> and <a href="#terms">Terms of Service</a>.
            </span>
          </div>
          <div className="compliance-actions">
            <button className="btn-decline" onClick={() => setCookieConsent(false)}>Decline</button>
            <button className="btn-accept" onClick={() => setCookieConsent(false)}>Accept Cookies</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
