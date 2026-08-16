export interface CinemaStudioMetrics {
  timestamp: string;
  activeRenderNodes: number;
  gpuUtilizationPercent: number;
  renderQueueLatencyMs: number;
  totalSceneBudgetUSD: number;
  spentSceneBudgetUSD: number;
  llmTokenCostUSD: number;
  activeScene: string;
  systemHealth: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
}

export class StudioMetricsEmitter {
  private currentMetrics: CinemaStudioMetrics;
  private intervalId?: NodeJS.Timeout;
  private listeners: Array<(metrics: CinemaStudioMetrics) => void> = [];

  constructor() {
    this.currentMetrics = {
      timestamp: new Date().toLocaleTimeString(),
      activeRenderNodes: 16,
      gpuUtilizationPercent: 78.5,
      renderQueueLatencyMs: 120,
      totalSceneBudgetUSD: 50000,
      spentSceneBudgetUSD: 14250,
      llmTokenCostUSD: 12.45,
      activeScene: 'Scene 4 - Cyberpunk Alley Chase',
      systemHealth: 'OPTIMAL',
    };
  }

  public startEmitting(intervalMs: number = 3000): void {
    if (this.intervalId) return;

    console.log('[Studio Telemetry Emitter] Started broadcasting live cinema studio metrics...');
    this.intervalId = setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stopEmitting(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      console.log('[Studio Telemetry Emitter] Stopped metrics emitter.');
    }
  }

  public subscribe(callback: (metrics: CinemaStudioMetrics) => void): () => void {
    this.listeners.push(callback);
    // Send immediate initial state
    callback(this.currentMetrics);

    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public getSnapshot(): CinemaStudioMetrics {
    return { ...this.currentMetrics };
  }

  private tick(): void {
    // Simulate slight natural fluctuations in live studio telemetry
    const gpuDelta = (Math.random() - 0.48) * 4;
    const latencyDelta = Math.floor((Math.random() - 0.5) * 15);
    const tokenIncrement = parseFloat((Math.random() * 0.05).toFixed(3));

    this.currentMetrics = {
      ...this.currentMetrics,
      timestamp: new Date().toLocaleTimeString(),
      gpuUtilizationPercent: Math.min(99.9, Math.max(20.0, parseFloat((this.currentMetrics.gpuUtilizationPercent + gpuDelta).toFixed(1)))),
      renderQueueLatencyMs: Math.max(45, this.currentMetrics.renderQueueLatencyMs + latencyDelta),
      llmTokenCostUSD: parseFloat((this.currentMetrics.llmTokenCostUSD + tokenIncrement).toFixed(3)),
      spentSceneBudgetUSD: parseFloat((this.currentMetrics.spentSceneBudgetUSD + tokenIncrement * 1.5).toFixed(2)),
    };

    // Broadcast to all subscribers
    this.listeners.forEach((listener) => listener(this.currentMetrics));
  }
}

export const globalStudioMetrics = new StudioMetricsEmitter();
