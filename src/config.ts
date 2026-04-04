import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface ZClawdConfig {
  /** Path to Claude Code binary */
  claudeBin: string;
  /** Working directory for Claude Code sessions */
  workspace: string;
  /** Heartbeat interval in milliseconds */
  heartbeatIntervalMs: number;
  /** Health check interval in milliseconds */
  healthCheckIntervalMs: number;
  /** Delay before restarting after crash */
  restartDelayMs: number;
  /** Max restarts before backing off */
  maxRestarts: number;
  /** Backoff delay after max restarts */
  backoffMs: number;
  /** Heartbeat message to send */
  heartbeatMessage: string;
  /** Claude model to use */
  model?: string;
}

const DEFAULT_CONFIG: ZClawdConfig = {
  claudeBin: join(homedir(), ".local", "bin", "claude"),
  workspace: join(homedir(), "zclawd-workspace"),
  heartbeatIntervalMs: 60 * 60 * 1000,
  healthCheckIntervalMs: 10_000,
  restartDelayMs: 5_000,
  maxRestarts: 50,
  backoffMs: 60_000,
  heartbeatMessage: "/heartbeat",
};

export function getConfigPath(): string {
  return join(homedir(), ".zclawd", "config.json");
}

export function getDataDir(): string {
  return join(homedir(), ".zclawd");
}

export function loadConfig(): ZClawdConfig {
  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      return { ...DEFAULT_CONFIG, ...raw };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
  return { ...DEFAULT_CONFIG };
}
