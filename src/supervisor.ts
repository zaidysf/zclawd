import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { ZClawdConfig, getConfigPath } from "./config.js";
import { State, loadState, saveState } from "./state.js";
import { log } from "./logger.js";
import { getDueReminders, markReminderRun } from "./reminders.js";

// node-pty types
interface IPty {
  pid: number;
  write(data: string): void;
  kill(signal?: string): void;
  onData: (callback: (data: string) => void) => { dispose(): void };
  onExit: (callback: (e: { exitCode: number; signal?: number }) => void) => { dispose(): void };
}

export class Supervisor {
  private pty: IPty | null = null;
  private state: State;
  private shuttingDown = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reminderTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private config: ZClawdConfig) {
    this.state = loadState();
  }

  start(): void {
    log("INFO", "ZClawd supervisor starting");
    log("INFO", `State: ${JSON.stringify(this.state)}`);

    const isResume = !!this.state.sessionId;
    this.notifyTelegram(isResume ? "🟢 ZClawd back online (resuming session)" : "🟢 ZClawd started");

    this.spawnClaude();
    this.startTimers();

    process.on("SIGINT", () => this.shutdown("SIGINT"));
    process.on("SIGTERM", () => this.shutdown("SIGTERM"));
  }

  private async spawnClaude(): Promise<void> {
    const args = ["--dangerously-skip-permissions"];

    // Enable Telegram channel if configured
    const rawConfig = existsSync(getConfigPath())
      ? JSON.parse(readFileSync(getConfigPath(), "utf-8"))
      : {};
    if (rawConfig.telegram?.botToken) {
      args.push("--channels", "plugin:telegram@claude-plugins-official");
    }

    if (this.config.model) {
      args.push("--model", this.config.model);
    }

    if (this.state.sessionId) {
      args.push("--resume", this.state.sessionId);
      log("INFO", `Resuming session: ${this.state.sessionId}`);
    } else {
      log("INFO", "Starting new session");
    }

    // Use node-pty for a real terminal so plugins (Telegram, etc.) work
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const nodePty = require("node-pty");
    // Build env — inject Pinecone key from config if available
    const env: Record<string, string> = { ...process.env } as Record<string, string>;
    const configPath = getConfigPath();
    if (existsSync(configPath)) {
      try {
        const raw = JSON.parse(readFileSync(configPath, "utf-8"));
        if (raw.pinecone?.apiKey) env.PINECONE_API_KEY = raw.pinecone.apiKey;
      } catch {}
    }

    // Ensure bun and other tools are in PATH
    const home = homedir();
    // Find nvm node path dynamically
    const nvmNodeDir = join(home, ".nvm", "versions", "node");
    let nvmBin = "";
    if (existsSync(nvmNodeDir)) {
      try {
        const versions = readdirSync(nvmNodeDir).sort().reverse();
        if (versions.length > 0) nvmBin = join(nvmNodeDir, versions[0], "bin");
      } catch {}
    }
    const extraPaths = [
      join(home, ".bun", "bin"),
      join(home, ".local", "bin"),
      ...(nvmBin ? [nvmBin] : []),
    ].filter((p) => existsSync(p));
    if (extraPaths.length > 0) {
      env.PATH = [...extraPaths, env.PATH || ""].join(":");
    }

    this.pty = nodePty.spawn(this.config.claudeBin, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: this.config.workspace,
      env,
    }) as IPty;

    this.state.pid = this.pty.pid;
    this.state.startedAt = new Date().toISOString();
    saveState(this.state);

    // Poll for session ID from Claude's session file
    this.pollSessionId();

    this.pty.onData((data: string) => {
      // Strip all ANSI/terminal escape sequences and control chars
      const clean = data
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b[\[\]()#;?]*[0-9;]*[a-zA-Z@`]/g, "")  // all CSI/OSC
        .replace(/\x1b[P>|=<][^\x1b]*/g, "")                  // DCS etc
        .replace(/\x1b\\/g, "")                                // ST
        .replace(/\x1b./g, "")                                 // remaining
        .replace(/\[\?[0-9]+[hl]/g, "")                        // bare mode sequences
        .replace(/>[0-9]+[a-z]/g, "")                          // bare >0q etc
        .replace(/<[a-z]+/g, "")                               // bare <u etc
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x09\x0b-\x1f\x7f]/g, "")            // control chars
        .trim();
      if (!clean || clean.length < 3) return;

      // Skip cursor/redraw noise and box-drawing
      if (/^[↑↓←→│─┌┐└┘├┤┬┴┼╭╮╯╰═║╔╗╚╝▐▛▜▌▝▘\s⏵◐·]+$/.test(clean)) return;

      // Detect stale session — auto-reset and start fresh
      if (clean.includes("No conversation found")) {
        log("WARN", "Session ID is stale — resetting to start fresh");
        this.state.sessionId = null;
        saveState(this.state);
      }

      log("OUTPUT", clean.substring(0, 500));
    });

    this.pty.onExit(({ exitCode, signal }) => {
      log("WARN", `Claude exited: code=${exitCode} signal=${signal}`);
      this.pty = null;

      if (this.shuttingDown) return;

      this.state.restartCount++;
      saveState(this.state);

      const delay =
        this.state.restartCount > this.config.maxRestarts
          ? this.config.backoffMs
          : this.config.restartDelayMs;

      log("INFO", `Restarting in ${delay}ms (restart #${this.state.restartCount})`);
      this.notifyTelegram(`🔄 ZClawd restarting... (restart #${this.state.restartCount})`);
      setTimeout(() => this.spawnClaude(), delay);
    });
  }

  private notifyTelegram(text: string): void {
    try {
      const configPath = getConfigPath();
      if (!existsSync(configPath)) return;
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      const botToken = raw.telegram?.botToken;
      if (!botToken) return;

      // Find chat IDs from approved senders
      const accessPath = join(homedir(), ".claude", "channels", "telegram", "access.json");
      if (!existsSync(accessPath)) return;
      const access = JSON.parse(readFileSync(accessPath, "utf-8"));
      const chatIds: string[] = access.allowFrom || [];

      for (const chatId of chatIds) {
        try {
          const body = JSON.stringify({ chat_id: chatId, text });
          execSync(
            `curl -s --max-time 10 -X POST "https://api.telegram.org/bot${botToken}/sendMessage" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`,
            { stdio: "ignore" }
          );
        } catch {}
      }
    } catch {}
  }

  private pollSessionId(): void {
    if (this.state.sessionId) return;

    const pid = this.state.pid;
    if (!pid) return;

    let attempts = 0;
    const maxAttempts = 30; // 30 seconds

    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => {
      attempts++;
      const sessionFile = join(homedir(), ".claude", "sessions", `${pid}.json`);

      if (existsSync(sessionFile)) {
        try {
          const data = JSON.parse(readFileSync(sessionFile, "utf-8"));
          if (data.sessionId) {
            this.state.sessionId = data.sessionId;
            saveState(this.state);
            log("INFO", `Session ID: ${this.state.sessionId}`);
            if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
          }
        } catch {
          // File might still be written
        }
      }

      if (attempts >= maxAttempts) {
        log("WARN", "Could not capture session ID after 30s");
        if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
      }
    }, 1000);
  }

  private sendMessage(msg: string): void {
    if (!this.pty) {
      log("WARN", `Cannot send message — process not ready`);
      return;
    }
    this.pty.write(msg + "\r");
  }

  private sendHeartbeat(): void {
    log("INFO", "Sending heartbeat");
    this.sendMessage(this.config.heartbeatMessage);
    this.state.lastHeartbeat = new Date().toISOString();
    saveState(this.state);
  }

  private checkReminders(): void {
    try {
      const due = getDueReminders();
      for (const reminder of due) {
        log("INFO", `Reminder due: [${reminder.id}] ${reminder.prompt.substring(0, 50)}`);
        this.sendMessage(reminder.prompt);
        markReminderRun(reminder.id);
      }
    } catch (err) {
      // Don't crash the supervisor on reminder errors
    }
  }

  private startTimers(): void {
    this.heartbeatTimer = setInterval(
      () => this.sendHeartbeat(),
      this.config.heartbeatIntervalMs
    );
    this.healthCheckTimer = setInterval(() => {
      if (!this.pty) {
        if (!this.shuttingDown) {
          log("WARN", "Health check: process not running");
        }
      }
    }, this.config.healthCheckIntervalMs);
    // Check reminders every 60 seconds
    this.reminderTimer = setInterval(() => this.checkReminders(), 60_000);
  }

  private shutdown(signal: string): void {
    log("INFO", `Received ${signal}, shutting down`);
    this.shuttingDown = true;

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.reminderTimer) clearInterval(this.reminderTimer);

    if (this.pty) {
      this.pty.kill("SIGTERM");
      setTimeout(() => {
        if (this.pty) {
          log("WARN", "Force killing Claude");
          this.pty.kill("SIGKILL");
        }
        process.exit(0);
      }, 10_000);
    } else {
      process.exit(0);
    }
  }

  getState(): State {
    return { ...this.state };
  }
}
