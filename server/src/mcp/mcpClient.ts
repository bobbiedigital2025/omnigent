import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import * as fs from 'fs';
import * as path from 'path';

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export class McpClientManager {
  private clients: Map<string, Client> = new Map();
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(__dirname, '../../mcp-config.json');
  }

  /**
   * Reads the configuration file and connects to all configured MCP servers.
   */
  async initializeAll(): Promise<void> {
    console.log(`[MCP Manager] Loading configuration from ${this.configPath}...`);
    
    if (!fs.existsSync(this.configPath)) {
      console.warn(`[MCP Manager] Configuration file not found at ${this.configPath}. Skipping initialization.`);
      return;
    }

    try {
      const configContent = fs.readFileSync(this.configPath, 'utf-8');
      const config: McpConfig = JSON.parse(configContent);

      for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
        await this.connectToServer(serverName, serverConfig);
      }
    } catch (err) {
      console.error('[MCP Manager] Failed to parse configuration or initialize servers:', err);
    }
  }

  /**
   * Spawns an MCP server and connects to it using Stdio.
   */
  async connectToServer(name: string, config: McpServerConfig): Promise<void> {
    console.log(`[MCP Manager] Connecting to server "${name}" using command: ${config.command} ${config.args?.join(' ') || ''}`);
    
    try {
      // Create a new client session
      const client = new Client(
        {
          name: `omnigent-orchestrator-${name}`,
          version: "1.0.0",
        },
        {
          capabilities: {}
        }
      );

      // Setup stdio transport
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: {
          ...process.env,
          ...(config.env || {}),
        } as any
      });

      // Connect to the transport
      await client.connect(transport);
      this.clients.set(name, client);
      console.log(`[MCP Manager] Successfully connected to server "${name}"`);
    } catch (err: any) {
      console.error(`[MCP Manager] Failed to connect to server "${name}":`, err.message);
    }
  }

  /**
   * Retrieves all tools from all connected servers.
   */
  async listAllTools(): Promise<Array<{ serverName: string; tool: any }>> {
    const allTools: Array<{ serverName: string; tool: any }> = [];

    for (const [serverName, client] of this.clients.entries()) {
      try {
        const response = await client.listTools();
        if (response && response.tools) {
          for (const tool of response.tools) {
            allTools.push({ serverName, tool });
          }
        }
      } catch (err: any) {
        console.error(`[MCP Manager] Error listing tools for server "${serverName}":`, err.message);
      }
    }

    return allTools;
  }

  /**
   * Calls a tool on a specific connected server.
   */
  async callTool(serverName: string, toolName: string, args: Record<string, any>): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP Server "${serverName}" is not connected or registered.`);
    }

    console.log(`[MCP Manager] Calling tool "${toolName}" on server "${serverName}" with args:`, args);
    try {
      return await client.callTool({
        name: toolName,
        arguments: args
      });
    } catch (err: any) {
      console.error(`[MCP Manager] Error calling tool "${toolName}" on server "${serverName}":`, err.message);
      throw err;
    }
  }

  /**
   * Disconnects and shuts down all connected servers.
   */
  async shutdownAll(): Promise<void> {
    console.log('[MCP Manager] Shutting down all MCP server connections...');
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
        console.log(`[MCP Manager] Disconnected from server "${name}"`);
      } catch (err: any) {
        console.error(`[MCP Manager] Error closing client for "${name}":`, err.message);
      }
    }
    this.clients.clear();
  }
}
