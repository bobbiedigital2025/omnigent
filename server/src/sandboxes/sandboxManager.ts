import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ISandboxInstance {
  agentId: string;
  type: 'e2b' | 'local_fallback';
  createdAt: Date;
  runCommand(command: string): Promise<ExecutionResult>;
  writeFile(filePath: string, content: string): Promise<void>;
  readFile(filePath: string): Promise<string>;
  destroy(): Promise<void>;
}

/**
 * Local directory sandbox implementation (used when E2B_API_KEY is omitted or in offline dev)
 */
class LocalDirectorySandbox implements ISandboxInstance {
  public agentId: string;
  public type: 'local_fallback' = 'local_fallback';
  public createdAt: Date;
  private workingDir: string;

  constructor(agentId: string) {
    this.agentId = agentId;
    this.createdAt = new Date();
    this.workingDir = path.resolve(process.cwd(), 'sandboxes', agentId);
    fs.mkdirpSync(this.workingDir);
  }

  async runCommand(command: string): Promise<ExecutionResult> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command, { cwd: this.workingDir });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
      };
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.resolve(this.workingDir, filePath);
    await fs.mkdirp(path.dirname(fullPath));
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  async readFile(filePath: string): Promise<string> {
    const fullPath = path.resolve(this.workingDir, filePath);
    return await fs.readFile(fullPath, 'utf-8');
  }

  async destroy(): Promise<void> {
    // Optionally clean up or preserve local sandbox contents
    console.log(`[SandboxManager] Destroying local sandbox for agent: ${this.agentId}`);
  }
}

/**
 * E2B Cloud Sandbox wrapper
 */
class E2BSandboxWrapper implements ISandboxInstance {
  public agentId: string;
  public type: 'e2b' = 'e2b';
  public createdAt: Date;
  private sandbox: any;

  constructor(agentId: string, sandboxInstance: any) {
    this.agentId = agentId;
    this.createdAt = new Date();
    this.sandbox = sandboxInstance;
  }

  async runCommand(command: string): Promise<ExecutionResult> {
    if (this.sandbox.commands?.run) {
      const res = await this.sandbox.commands.run(command);
      return {
        stdout: res.stdout || '',
        stderr: res.stderr || '',
        exitCode: res.exitCode ?? 0,
      };
    } else if (this.sandbox.runCode) {
      const res = await this.sandbox.runCode(command);
      return {
        stdout: res.logs?.stdout?.join('\n') || '',
        stderr: res.logs?.stderr?.join('\n') || res.error?.value || '',
        exitCode: res.error ? 1 : 0,
      };
    }
    throw new Error('Unsupported E2B sandbox instance method');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (this.sandbox.files?.write) {
      await this.sandbox.files.write(filePath, content);
    } else {
      await this.runCommand(`mkdir -p $(dirname "${filePath}") && cat << 'EOF' > "${filePath}"\n${content}\nEOF`);
    }
  }

  async readFile(filePath: string): Promise<string> {
    if (this.sandbox.files?.read) {
      return await this.sandbox.files.read(filePath);
    } else {
      const res = await this.runCommand(`cat "${filePath}"`);
      return res.stdout;
    }
  }

  async destroy(): Promise<void> {
    console.log(`[SandboxManager] Killing E2B cloud sandbox for agent: ${this.agentId}`);
    if (typeof this.sandbox.kill === 'function') {
      await this.sandbox.kill();
    }
  }
}

/**
 * Central Manager to create and manage agent sandboxes
 */
export class SandboxManager {
  private activeSandboxes: Map<string, ISandboxInstance> = new Map();

  /**
   * Get an existing sandbox or spawn a new one for an agent
   */
  async getOrCreateSandbox(agentId: string, options?: { template?: string }): Promise<ISandboxInstance> {
    if (this.activeSandboxes.has(agentId)) {
      return this.activeSandboxes.get(agentId)!;
    }

    const apiKey = process.env.E2B_API_KEY;
    if (apiKey) {
      try {
        console.log(`[SandboxManager] Initializing E2B Cloud Sandbox for agent '${agentId}'...`);
        const e2bModule = await import('@e2b/code-interpreter');
        const SandboxClass = e2bModule.Sandbox;
        const e2bInstance = await SandboxClass.create({ apiKey, template: options?.template });
        
        const instance = new E2BSandboxWrapper(agentId, e2bInstance);
        this.activeSandboxes.set(agentId, instance);
        console.log(`[SandboxManager] E2B Cloud Sandbox ready for '${agentId}'.`);
        return instance;
      } catch (err: any) {
        console.warn(`[SandboxManager] Could not spawn E2B sandbox (${err.message}). Falling back to local directory sandbox.`);
      }
    } else {
      console.log(`[SandboxManager] E2B_API_KEY not set. Using isolated local workspace sandbox for agent '${agentId}'.`);
    }

    const localInstance = new LocalDirectorySandbox(agentId);
    this.activeSandboxes.set(agentId, localInstance);
    return localInstance;
  }

  /**
   * Run a command inside an agent's sandbox
   */
  async runCommand(agentId: string, command: string): Promise<ExecutionResult> {
    const sandbox = await this.getOrCreateSandbox(agentId);
    return await sandbox.runCommand(command);
  }

  /**
   * Write a file inside an agent's sandbox
   */
  async writeFile(agentId: string, filePath: string, content: string): Promise<void> {
    const sandbox = await this.getOrCreateSandbox(agentId);
    await sandbox.writeFile(filePath, content);
  }

  /**
   * Read a file from an agent's sandbox
   */
  async readFile(agentId: string, filePath: string): Promise<string> {
    const sandbox = await this.getOrCreateSandbox(agentId);
    return await sandbox.readFile(filePath);
  }

  /**
   * Destroy a sandbox for a given agent
   */
  async destroySandbox(agentId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(agentId);
    if (sandbox) {
      await sandbox.destroy();
      this.activeSandboxes.delete(agentId);
    }
  }

  /**
   * List all currently active sandboxes
   */
  listActiveSandboxes(): Array<{ agentId: string; type: string; createdAt: Date }> {
    return Array.from(this.activeSandboxes.values()).map((sb) => ({
      agentId: sb.agentId,
      type: sb.type,
      createdAt: sb.createdAt,
    }));
  }
}

export const globalSandboxManager = new SandboxManager();
