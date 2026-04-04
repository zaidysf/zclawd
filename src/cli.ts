#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, readFileSync, copyFileSync, readdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { execSync, spawn } from "node:child_process";
import { homedir } from "node:os";
import { loadConfig, getConfigPath, getDataDir, ZClawdConfig } from "./config.js";
import { loadState } from "./state.js";

const ZCLAWD_DIR = getDataDir();
const SKILLS_SOURCE = join(dirname(import.meta.dirname), "skills");
const CLAUDE_MD_SOURCE = join(dirname(import.meta.dirname), "templates", "CLAUDE.md");

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true });
}

function printHelp(): void {
  console.log(`
            ********************
          ****                ***
         ****************   ***
                    ***    ***
                  ****   ***
                 ***   ***********
               ***   ******  ****
             ***   ***  *  ***    ***
           ***   ****  *******   ** **
         +**   ******************* **
         **           ********   +**
         *************************

  ZClawd — Always-on AI assistant powered by Claude Code

Usage: zclawd <command>

Commands:
  setup       Interactive setup — installs skills, CLAUDE.md, and config
  start       Start the supervisor (spawns Claude Code session)
  stop        Stop the running supervisor
  restart     Restart the supervisor
  foreground  Run in foreground (for debugging/first run)
  status      Show session status (uptime, session ID, last heartbeat)
  logs        Show recent logs
  config      Show current configuration
  reset       Reset session (clear session ID, start fresh)

Configuration:
  auth        Authenticate Claude Code (runs claude login)
  model       Set Claude model (zclawd model <model-name>)
  telegram    Configure Telegram bot (validates, writes .env, clears webhooks)
  pinecone    Configure Pinecone API key (zclawd pinecone <api-key>)
  pair        Open interactive session to pair your Telegram account
  doctor      Check everything: node, bun, claude, auth, telegram, plugins

Migration:
  migrate     Import from OpenClaw (zclawd migrate [path-to-openclaw-dir])
  export      Export ZClawd config and data for backup

Service:
  install     Install as systemd service for auto-start on boot
  uninstall   Remove systemd service
`);
}

function cmdSetup(): void {
  console.log("🔧 ZClawd Setup\n");

  // 1. Create data directory
  ensureDir(ZCLAWD_DIR);
  console.log(`✓ Data directory: ${ZCLAWD_DIR}`);

  // 2. Create default config if not exists
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    const defaultConfig: Partial<ZClawdConfig> = {
      workspace: join(homedir(), "zclawd-workspace"),
      heartbeatIntervalMs: 60 * 60 * 1000,
    };
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`✓ Config created: ${configPath}`);
  } else {
    console.log(`✓ Config exists: ${configPath}`);
  }

  // 3. Create workspace if not exists
  const config = loadConfig();
  ensureDir(config.workspace);
  console.log(`✓ Workspace: ${config.workspace}`);

  // 4. Install skills into Claude Code
  const claudeSkillsDir = join(homedir(), ".claude", "skills");
  ensureDir(claudeSkillsDir);

  if (existsSync(SKILLS_SOURCE)) {
    const skills = readdirSync(SKILLS_SOURCE).filter((f) => f.endsWith(".md"));
    for (const skill of skills) {
      copyFileSync(join(SKILLS_SOURCE, skill), join(claudeSkillsDir, skill));
      console.log(`✓ Skill installed: ${skill}`);
    }
  }

  // 5. Install CLAUDE.md template into workspace
  const claudeMdDest = join(config.workspace, "CLAUDE.md");
  if (existsSync(CLAUDE_MD_SOURCE) && !existsSync(claudeMdDest)) {
    copyFileSync(CLAUDE_MD_SOURCE, claudeMdDest);
    console.log(`✓ CLAUDE.md template installed: ${claudeMdDest}`);
  } else if (existsSync(claudeMdDest)) {
    console.log(`✓ CLAUDE.md already exists: ${claudeMdDest}`);
  }

  // 6. Trust workspace in Claude Code
  const claudeJsonPath = join(homedir(), ".claude.json");
  if (existsSync(claudeJsonPath)) {
    try {
      const claudeJson = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));
      if (!claudeJson.projects) claudeJson.projects = {};
      if (!claudeJson.projects[config.workspace]?.hasTrustDialogAccepted) {
        claudeJson.projects[config.workspace] = {
          ...(claudeJson.projects[config.workspace] || {}),
          allowedTools: [],
          mcpContextUris: [],
          mcpServers: {},
          enabledMcpjsonServers: [],
          disabledMcpjsonServers: [],
          hasTrustDialogAccepted: true,
          projectOnboardingSeenCount: 1,
          hasClaudeMdExternalIncludesApproved: false,
          hasClaudeMdExternalIncludesWarningShown: false,
          exampleFiles: [],
        };
        writeFileSync(claudeJsonPath, JSON.stringify(claudeJson, null, 2));
        console.log(`✓ Workspace trusted in Claude Code`);
      } else {
        console.log(`✓ Workspace already trusted`);
      }
    } catch {
      console.log(`⚠ Could not update .claude.json — trust workspace manually`);
    }
  }

  // 7. Check Claude Code is installed
  try {
    const version = execSync(`${config.claudeBin} --version 2>/dev/null`).toString().trim();
    console.log(`✓ Claude Code found: ${version}`);
  } catch {
    console.log(`✗ Claude Code not found at: ${config.claudeBin}`);
    console.log(`  Install: npm install -g @anthropic-ai/claude-code`);
    console.log(`  Or update claudeBin in ${configPath}`);
    return;
  }

  console.log("\n✅ Setup complete. Run 'zclawd start' to begin.");
  console.log("\nOptional next steps:");
  console.log("  zclawd auth          Authenticate Claude Code (runs claude login)");
  console.log("  zclawd telegram      Configure Telegram bot token");
  console.log("  zclawd pinecone      Configure Pinecone API key");
  console.log("  zclawd install       Install as systemd service for auto-start");
}

function preflight(): boolean {
  const configPath = getConfigPath();
  if (!existsSync(configPath)) {
    console.log("✗ Not set up yet. Run 'zclawd setup' first.");
    return false;
  }

  const raw = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
  const config = loadConfig();
  let ok = true;

  // Check Claude Code exists
  try {
    execSync(`${config.claudeBin} --version 2>/dev/null`, { stdio: "pipe" });
  } catch {
    console.log(`✗ Claude Code not found at: ${config.claudeBin}`);
    console.log("  Run: npm install -g @anthropic-ai/claude-code");
    ok = false;
  }

  // Check auth — verify .claude.json has some auth
  const claudeJsonPath = join(homedir(), ".claude.json");
  if (!existsSync(claudeJsonPath)) {
    console.log("✗ Claude Code not authenticated. Run 'zclawd auth' first.");
    ok = false;
  }

  // Check workspace trusted
  if (existsSync(claudeJsonPath)) {
    try {
      const cj = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));
      if (!cj.projects?.[config.workspace]?.hasTrustDialogAccepted) {
        console.log("✗ Workspace not trusted. Run 'zclawd setup' to fix.");
        ok = false;
      }
    } catch {}
  }

  // Check Telegram — required
  if (!raw.telegram?.botToken) {
    console.log("✗ Telegram not configured. Run 'zclawd telegram <bot-token>' first.");
    console.log("  Get a token from @BotFather on Telegram.");
    ok = false;
  }

  // Check Pinecone — optional but warn
  if (!raw.pinecone?.apiKey) {
    console.log("⚠ Pinecone not configured (optional). Long-term memory won't work.");
    console.log("  Run: zclawd pinecone <api-key>");
  }

  if (!ok) {
    console.log("\nFix the above issues before starting.");
  }

  return ok;
}

function killExisting(): void {
  const state = loadState();
  if (state.pid) {
    try {
      process.kill(state.pid, 0); // check alive
      process.kill(state.pid, "SIGTERM");
      // Also kill any claude child processes
      try { execSync(`pkill -P ${state.pid} 2>/dev/null`, { stdio: "ignore" }); } catch {}
      // Wait briefly for clean exit
      try { execSync(`sleep 1`, { stdio: "ignore" }); } catch {}
    } catch {
      // Already dead
    }
  }
  // Also kill any stray supervisor processes (exclude our own PID)
  try {
    execSync(`pgrep -f "node.*zclawd.*dist/index.js" | grep -v ${process.pid} | xargs -r kill 2>/dev/null`, { stdio: "ignore" });
  } catch {}
}

function cmdStart(): void {
  if (!preflight()) return;

  // Kill any existing supervisor first
  killExisting();

  const config = loadConfig();
  const raw = JSON.parse(readFileSync(getConfigPath(), "utf-8"));

  // Build env — include Pinecone key if configured
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  if (raw.pinecone?.apiKey) {
    env.PINECONE_API_KEY = raw.pinecone.apiKey;
  }

  console.log("Starting ZClawd supervisor...");

  const child = spawn("node", [join(dirname(import.meta.dirname), "dist", "index.js")], {
    cwd: config.workspace,
    detached: true,
    stdio: "ignore",
    env,
  });

  child.unref();
  console.log(`ZClawd started (PID: ${child.pid})`);
  console.log("Use 'zclawd status' to check, 'zclawd logs' to view output.");
}

function cmdStartForeground(): void {
  if (!preflight()) return;
  // For systemd / pm2 — runs in foreground
  import("./index.js");
}

function cmdStop(): void {
  killExisting();
  console.log("ZClawd stopped.");
}

function cmdRestart(): void {
  cmdStop();
  setTimeout(() => cmdStart(), 2000);
}

function cmdStatus(): void {
  const state = loadState();
  const config = loadConfig();

  console.log("ZClawd Status\n");
  console.log(`  Session ID:     ${state.sessionId ?? "none"}`);
  console.log(`  PID:            ${state.pid ?? "not running"}`);
  console.log(`  Started at:     ${state.startedAt ?? "never"}`);
  console.log(`  Restart count:  ${state.restartCount}`);
  console.log(`  Last heartbeat: ${state.lastHeartbeat ?? "never"}`);
  console.log(`  Workspace:      ${config.workspace}`);
  console.log(`  Claude binary:  ${config.claudeBin}`);

  // Check if process is actually alive
  if (state.pid) {
    try {
      process.kill(state.pid, 0);
      console.log(`  Process:        alive`);
    } catch {
      console.log(`  Process:        dead (stale PID)`);
    }
  }
}

function cmdLogs(): void {
  const logDir = join(ZCLAWD_DIR, "logs");
  const today = new Date().toISOString().split("T")[0];
  const logFile = join(logDir, `${today}.log`);

  if (existsSync(logFile)) {
    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n");
    // Show last 50 lines
    console.log(lines.slice(-50).join("\n"));
  } else {
    console.log("No logs for today.");
  }
}

function cmdConfig(): void {
  const config = loadConfig();
  console.log(JSON.stringify(config, null, 2));
}

function cmdReset(): void {
  const statePath = join(ZCLAWD_DIR, "state.json");
  if (existsSync(statePath)) {
    writeFileSync(
      statePath,
      JSON.stringify({
        sessionId: null,
        startedAt: null,
        restartCount: 0,
        lastHeartbeat: null,
        pid: null,
      }, null, 2)
    );
    console.log("Session reset. Next start will create a new session.");
  } else {
    console.log("No state to reset.");
  }
}

function cmdInstall(): void {
  const config = loadConfig();
  const user = process.env.SUDO_USER ?? process.env.USER ?? execSync("id -un", { encoding: "utf-8" }).trim();
  const home = homedir();
  const raw = existsSync(getConfigPath()) ? JSON.parse(readFileSync(getConfigPath(), "utf-8")) : {};

  // Build PATH with bun, nvm node, local bin
  const pathDirs = [
    join(home, ".bun", "bin"),
    join(home, ".local", "bin"),
    join(home, ".nvm", "versions", "node"),  // will glob below
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
  ];

  // Find actual nvm node path
  try {
    const nodePath = execSync("dirname $(which node)", { encoding: "utf-8" }).trim();
    if (nodePath && !pathDirs.includes(nodePath)) pathDirs.unshift(nodePath);
  } catch {}

  const envLines = [
    `Environment=NODE_ENV=production`,
    `Environment=HOME=${home}`,
    `Environment=PATH=${pathDirs.join(":")}`,
  ];

  if (raw.pinecone?.apiKey) {
    envLines.push(`Environment=PINECONE_API_KEY=${raw.pinecone.apiKey}`);
  }

  const service = `[Unit]
Description=ZClawd — Always-on Claude Code assistant
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
Group=${user}
ExecStart=${process.execPath} ${join(dirname(import.meta.dirname), "dist", "index.js")}
WorkingDirectory=${config.workspace}
Restart=always
RestartSec=10
StartLimitIntervalSec=300
StartLimitBurst=10
${envLines.join("\n")}

[Install]
WantedBy=multi-user.target
`;

  const servicePath = "/etc/systemd/system/zclawd.service";
  writeFileSync(servicePath, service);
  execSync("systemctl daemon-reload");
  execSync("systemctl enable zclawd");
  console.log(`✓ Systemd service installed: ${servicePath}`);
  console.log(`✓ Service enabled (auto-start on boot)`);
  console.log(`  User: ${user}`);
  console.log(`  Start: sudo systemctl start zclawd`);
  console.log(`  Logs:  journalctl -u zclawd -f`);
  console.log(`  Status: sudo systemctl status zclawd`);
}

function cmdUninstall(): void {
  try {
    execSync("systemctl stop zclawd 2>/dev/null");
    execSync("systemctl disable zclawd 2>/dev/null");
    execSync("rm -f /etc/systemd/system/zclawd.service");
    execSync("systemctl daemon-reload");
    console.log("✓ Systemd service removed.");
  } catch {
    console.log("Service not found or already removed.");
  }
}

function cmdAuth(): void {
  const config = loadConfig();
  console.log("Launching Claude Code login...\n");
  try {
    execSync(`${config.claudeBin} login`, { stdio: "inherit" });
    console.log("\n✓ Authentication complete.");
  } catch {
    console.log("\n✗ Authentication failed or cancelled.");
  }
}

function cmdTelegram(): void {
  const token = process.argv[3];
  if (!token) {
    console.log("Usage: zclawd telegram <bot-token>");
    console.log("\nGet a bot token from @BotFather on Telegram.");
    console.log("Example: zclawd telegram 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz");
    return;
  }

  // Validate bot token BEFORE saving
  try {
    const result = execSync(`curl -s "https://api.telegram.org/bot${token}/getMe"`, { encoding: "utf-8" });
    const data = JSON.parse(result);
    if (data.ok) {
      console.log(`✓ Bot verified: @${data.result.username} (${data.result.first_name})`);
    } else {
      console.log("✗ Bot token is invalid. Check with @BotFather.");
      return;
    }
  } catch {
    console.log("⚠ Could not verify bot token (network error). Saving anyway.");
  }

  // Save to ZClawd config
  const configPath = getConfigPath();
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
  config.telegram = { botToken: token };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✓ Telegram bot token saved to ZClawd config.");

  // Write .env for Claude Code's Telegram plugin
  const telegramDir = join(homedir(), ".claude", "channels", "telegram");
  ensureDir(telegramDir);
  writeFileSync(join(telegramDir, ".env"), `TELEGRAM_BOT_TOKEN=${token}\n`, { mode: 0o600 });
  console.log("✓ Token written to ~/.claude/channels/telegram/.env");

  // Enable Telegram plugin in Claude Code settings
  const claudeSettingsPath = join(homedir(), ".claude", "settings.json");
  let claudeSettings: Record<string, any> = {};
  if (existsSync(claudeSettingsPath)) {
    claudeSettings = JSON.parse(readFileSync(claudeSettingsPath, "utf-8"));
  }
  if (!claudeSettings.enabledPlugins) claudeSettings.enabledPlugins = {};
  claudeSettings.enabledPlugins["telegram@claude-plugins-official"] = true;
  writeFileSync(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
  console.log("✓ Telegram plugin enabled in Claude Code.");

  // Clear stale webhooks
  try {
    execSync(`curl -s "https://api.telegram.org/bot${token}/deleteWebhook"`, { stdio: "ignore" });
    console.log("✓ Cleared any stale webhooks.");
  } catch {}

  console.log("\nNext step: run 'zclawd pair' to pair your Telegram account.");
}

function cmdPair(): void {
  const senderId = process.argv[3];
  const raw = existsSync(getConfigPath()) ? JSON.parse(readFileSync(getConfigPath(), "utf-8")) : {};

  if (!raw.telegram?.botToken) {
    console.log("✗ Telegram not configured. Run 'zclawd telegram <token>' first.");
    return;
  }

  const token = raw.telegram.botToken;
  const telegramDir = join(homedir(), ".claude", "channels", "telegram");
  const accessPath = join(telegramDir, "access.json");
  const approvedDir = join(telegramDir, "approved");

  if (senderId) {
    // Direct pairing with sender ID
    ensureDir(approvedDir);

    // Update access.json
    let access: Record<string, any> = { dmPolicy: "pairing", allowFrom: [], groups: {}, pending: {} };
    if (existsSync(accessPath)) {
      try { access = JSON.parse(readFileSync(accessPath, "utf-8")); } catch {}
    }
    if (!access.allowFrom) access.allowFrom = [];
    if (!access.allowFrom.includes(senderId)) {
      access.allowFrom.push(senderId);
    }
    // Clear any pending for this sender
    for (const [code, info] of Object.entries(access.pending || {})) {
      if ((info as any).senderId === senderId) delete access.pending[code];
    }
    writeFileSync(accessPath, JSON.stringify(access, null, 2));
    writeFileSync(join(approvedDir, senderId), senderId);
    console.log(`✓ Sender ${senderId} approved for Telegram access.`);
    console.log("Restart ZClawd to apply: zclawd restart");
    return;
  }

  // Auto-pair: fetch recent messages from Telegram to find sender ID
  console.log("Fetching pending Telegram messages...\n");
  console.log("Step 1: Send any message to your bot on Telegram now.");
  console.log("Step 2: Press Enter here when you've sent it.\n");

  // Wait for user
  try { execSync("read -p 'Press Enter to continue...'", { stdio: "inherit" }); } catch {}

  try {
    const result = execSync(`curl -s "https://api.telegram.org/bot${token}/getUpdates?limit=5"`, { encoding: "utf-8" });
    const data = JSON.parse(result);

    if (!data.ok || !data.result?.length) {
      console.log("No messages found. Make sure you sent a message to the bot.");
      console.log("\nAlternative: find your Telegram user ID and run:");
      console.log("  zclawd pair <your-telegram-user-id>");
      return;
    }

    // Get unique senders
    const senders = new Map<string, string>();
    for (const update of data.result) {
      const msg = update.message;
      if (msg?.from) {
        senders.set(
          String(msg.from.id),
          `${msg.from.first_name ?? ""} ${msg.from.last_name ?? ""}`.trim() +
            (msg.from.username ? ` (@${msg.from.username})` : "")
        );
      }
    }

    if (senders.size === 0) {
      console.log("No senders found in recent messages.");
      return;
    }

    console.log("Found senders:");
    for (const [id, name] of senders) {
      console.log(`  ${id} — ${name}`);
    }

    // Auto-approve all found senders
    ensureDir(approvedDir);
    let access: Record<string, any> = { dmPolicy: "pairing", allowFrom: [], groups: {}, pending: {} };
    if (existsSync(accessPath)) {
      try { access = JSON.parse(readFileSync(accessPath, "utf-8")); } catch {}
    }
    if (!access.allowFrom) access.allowFrom = [];

    for (const [id, name] of senders) {
      if (!access.allowFrom.includes(id)) {
        access.allowFrom.push(id);
      }
      writeFileSync(join(approvedDir, id), id);
      console.log(`✓ Approved: ${name} (${id})`);
    }

    writeFileSync(accessPath, JSON.stringify(access, null, 2));

    // Clear the updates so the bot doesn't re-process them
    const lastUpdateId = data.result[data.result.length - 1].update_id;
    execSync(`curl -s "https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}"`, { stdio: "ignore" });

    console.log("\n✓ Pairing complete. Restart ZClawd: zclawd restart");
  } catch (err) {
    console.log(`Error: ${err}`);
    console.log("\nAlternative: find your Telegram user ID and run:");
    console.log("  zclawd pair <your-telegram-user-id>");
  }
}

function cmdDoctor(): void {
  console.log("ZClawd Doctor\n");
  let issues = 0;

  // 1. Node.js
  try {
    const nodeVer = execSync("node --version 2>/dev/null", { encoding: "utf-8" }).trim();
    const major = parseInt(nodeVer.replace("v", "").split(".")[0]);
    if (major >= 18) {
      console.log(`✓ Node.js: ${nodeVer}`);
    } else {
      console.log(`✗ Node.js: ${nodeVer} (need 18+)`);
      issues++;
    }
  } catch {
    console.log("✗ Node.js: not found");
    issues++;
  }

  // 2. Bun
  let bunFound = false;
  try {
    const bunVer = execSync("bun --version 2>/dev/null", { encoding: "utf-8" }).trim();
    console.log(`✓ Bun: ${bunVer}`);
    bunFound = true;
  } catch {
    try {
      const bunVer = execSync(`${join(homedir(), ".bun", "bin", "bun")} --version 2>/dev/null`, { encoding: "utf-8" }).trim();
      console.log(`✓ Bun: ${bunVer} (in ~/.bun/bin, may need PATH update)`);
      bunFound = true;
    } catch {
      console.log("✗ Bun: not found (required by Telegram plugin)");
      console.log("  Installing bun...");
      try {
        execSync("curl -fsSL https://bun.sh/install | bash", { stdio: "inherit" });
        console.log("✓ Bun: installed successfully");
        bunFound = true;
      } catch {
        console.log("✗ Bun: installation failed");
        console.log("  Manual fix: curl -fsSL https://bun.sh/install | bash && source ~/.bashrc");
        issues++;
      }
    }
  }

  // 3. Claude Code
  const config = loadConfig();
  try {
    const claudeVer = execSync(`${config.claudeBin} --version 2>/dev/null`, { encoding: "utf-8" }).trim();
    console.log(`✓ Claude Code: ${claudeVer}`);
  } catch {
    console.log(`✗ Claude Code: not found at ${config.claudeBin}`);
    console.log("  Fix: npm install -g @anthropic-ai/claude-code@latest");
    issues++;
  }

  // 4. Non-root
  if (process.getuid?.() === 0) {
    console.log("✗ Running as root (--dangerously-skip-permissions won't work)");
    console.log("  Fix: run as a non-root user");
    issues++;
  } else {
    console.log(`✓ User: ${process.env.USER ?? "non-root"}`);
  }

  // 5. Authentication
  const claudeJsonPath = join(homedir(), ".claude.json");
  if (existsSync(claudeJsonPath)) {
    console.log("✓ Claude Code: authenticated (.claude.json exists)");
  } else {
    console.log("✗ Claude Code: not authenticated");
    console.log("  Fix: zclawd auth");
    issues++;
  }

  // 6. Workspace trust
  if (existsSync(claudeJsonPath)) {
    try {
      const cj = JSON.parse(readFileSync(claudeJsonPath, "utf-8"));
      if (cj.projects?.[config.workspace]?.hasTrustDialogAccepted) {
        console.log(`✓ Workspace trusted: ${config.workspace}`);
      } else {
        console.log(`✗ Workspace not trusted: ${config.workspace}`);
        console.log("  Fix: zclawd setup");
        issues++;
      }
    } catch {}
  }

  // 7. ZClawd config
  if (existsSync(getConfigPath())) {
    console.log(`✓ ZClawd config: ${getConfigPath()}`);
  } else {
    console.log("✗ ZClawd config: not found");
    console.log("  Fix: zclawd setup");
    issues++;
  }

  // 8. Skills installed
  const skillsDir = join(homedir(), ".claude", "skills");
  const expectedSkills = ["heartbeat.md", "memory-save.md", "memory-load.md", "status.md"];
  const missingSkills = expectedSkills.filter((s) => !existsSync(join(skillsDir, s)));
  if (missingSkills.length === 0) {
    console.log(`✓ Skills: all ${expectedSkills.length} installed`);
  } else {
    console.log(`✗ Skills: missing ${missingSkills.join(", ")}`);
    console.log("  Fix: zclawd setup");
    issues++;
  }

  // 9. Telegram
  const raw = existsSync(getConfigPath()) ? JSON.parse(readFileSync(getConfigPath(), "utf-8")) : {};
  if (raw.telegram?.botToken) {
    const token = raw.telegram.botToken;
    console.log(`✓ Telegram: token configured`);

    // Verify bot
    try {
      const result = execSync(`curl -s "https://api.telegram.org/bot${token}/getMe"`, { encoding: "utf-8" });
      const data = JSON.parse(result);
      if (data.ok) {
        console.log(`✓ Telegram bot: @${data.result.username} (${data.result.first_name})`);
      } else {
        console.log("✗ Telegram bot: token is invalid");
        issues++;
      }
    } catch {
      console.log("⚠ Telegram bot: could not verify (network error)");
    }

    // Check .env
    const envPath = join(homedir(), ".claude", "channels", "telegram", ".env");
    if (existsSync(envPath)) {
      console.log("✓ Telegram .env: exists");
    } else {
      console.log("✗ Telegram .env: missing");
      console.log("  Fix: zclawd telegram <token>");
      issues++;
    }
  } else {
    console.log("✗ Telegram: not configured (required)");
    console.log("  Fix: zclawd telegram <bot-token>");
    issues++;
  }

  // 10. Pinecone
  if (raw.pinecone?.apiKey) {
    console.log("✓ Pinecone: API key configured");
  } else {
    console.log("⚠ Pinecone: not configured (optional, no long-term memory)");
  }

  // 11. CLAUDE.md — check exists and has required sections
  const claudeMd = join(config.workspace, "CLAUDE.md");
  if (existsSync(claudeMd)) {
    const content = readFileSync(claudeMd, "utf-8");
    const requiredSections: Array<{ marker: string; label: string; block: string }> = [
      {
        marker: "Always reply to every Telegram message",
        label: "Telegram reply rule",
        block: `
## Telegram

You communicate via Telegram. This is your primary interface.

**IMPORTANT: Always reply to every Telegram message.** When you receive a message from Telegram, you MUST use the \`reply\` tool to send a response back. Never silently process a message without responding. Even if you're unsure what to say, acknowledge the message.

- Use the \`reply\` tool with the \`chat_id\` from the incoming message
- Be concise — Telegram messages should be short and readable
- No markdown tables (use bullet lists instead)
- Wrap multiple links in \`<>\` to suppress previews
- If a task takes time, send a "Working on it..." message first, then the result`,
      },
      {
        marker: "/memory-save",
        label: "Memory instructions",
        block: `
## Memory

Your memory lives in Pinecone. Use it.

- **Save regularly**: After important conversations, decisions, or completed tasks — run \`/memory-save\`
- **Load on startup**: Run \`/memory-load\` to recall recent context
- **What to save**: Decisions, user preferences, completed work, things to remember, lessons learned
- **What NOT to save**: Secrets, tokens, passwords, temporary debugging info`,
      },
      {
        marker: "/heartbeat",
        label: "Heartbeat instructions",
        block: `
## Heartbeat

The sidecar sends \`/heartbeat\` periodically. When you receive it:
- Check if anything needs attention
- Save a brief session summary to Pinecone if significant work was done
- Reply with status or HEARTBEAT_OK if nothing notable`,
      },
    ];

    let modified = false;
    for (const section of requiredSections) {
      if (content.includes(section.marker)) {
        console.log(`✓ CLAUDE.md: has ${section.label}`);
      } else {
        console.log(`⚠ CLAUDE.md: missing ${section.label} — adding...`);
        appendFileSync(claudeMd, "\n" + section.block.trim() + "\n");
        modified = true;
      }
    }
    if (modified) {
      console.log("✓ CLAUDE.md: updated with missing sections");
    }
  } else {
    console.log("✗ CLAUDE.md: missing from workspace — creating...");
    const templatePath = join(dirname(import.meta.dirname), "templates", "CLAUDE.md");
    if (existsSync(templatePath)) {
      copyFileSync(templatePath, claudeMd);
      console.log("✓ CLAUDE.md: created from template");
    } else {
      console.log("✗ CLAUDE.md: template not found. Run zclawd setup.");
      issues++;
    }
  }

  // Summary
  console.log("");
  if (issues === 0) {
    console.log("All checks passed. Ready to run 'zclawd start'.");
  } else {
    console.log(`${issues} issue(s) found. Fix them before starting.`);
  }
}

function cmdPinecone(): void {
  const apiKey = process.argv[3];
  if (!apiKey) {
    console.log("Usage: zclawd pinecone <api-key>");
    console.log("\nGet an API key from https://app.pinecone.io/");
    return;
  }

  // Save to ZClawd config
  const configPath = getConfigPath();
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
  config.pinecone = { apiKey };
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✓ Pinecone API key saved to ZClawd config.");

  // Enable Pinecone plugin in Claude Code settings
  const claudeSettingsPath = join(homedir(), ".claude", "settings.json");
  let claudeSettings: Record<string, any> = {};
  if (existsSync(claudeSettingsPath)) {
    claudeSettings = JSON.parse(readFileSync(claudeSettingsPath, "utf-8"));
  }
  if (!claudeSettings.enabledPlugins) claudeSettings.enabledPlugins = {};
  claudeSettings.enabledPlugins["pinecone@claude-plugins-official"] = true;
  writeFileSync(claudeSettingsPath, JSON.stringify(claudeSettings, null, 2));
  console.log("✓ Pinecone plugin enabled in Claude Code.");

  // Add to shell profile for MCP server to pick up
  const bashrc = join(homedir(), ".bashrc");
  const exportLine = `export PINECONE_API_KEY="${apiKey}"`;
  if (existsSync(bashrc)) {
    const content = readFileSync(bashrc, "utf-8");
    if (!content.includes("PINECONE_API_KEY")) {
      appendFileSync(bashrc, `\n# Added by ZClawd\n${exportLine}\n`);
      console.log("✓ PINECONE_API_KEY added to ~/.bashrc");
    } else {
      console.log("✓ PINECONE_API_KEY already in ~/.bashrc");
    }
  }

  // Auto-create Pinecone index
  console.log("\nCreating Pinecone index...");
  ensurePineconeIndex(apiKey, "zclawd-memory").then((host) => {
    if (host) {
      console.log(`✓ Index ready: ${host}`);
    } else {
      console.log("⚠ Could not create index now. It will be created on first /memory-save.");
    }
  });
}

function cmdModel(): void {
  const model = process.argv[3];
  const available = [
    "claude-opus-4-6",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
  ];

  if (!model) {
    const configPath = getConfigPath();
    const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
    console.log(`Current model: ${config.model ?? "default (claude-sonnet-4-6)"}`);
    console.log(`\nUsage: zclawd model <model-name>`);
    console.log(`\nAvailable models:`);
    available.forEach((m) => console.log(`  - ${m}`));
    return;
  }

  const configPath = getConfigPath();
  const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
  config.model = model;
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✓ Model set to: ${model}`);
  console.log("Restart ZClawd to apply: zclawd restart");
}

async function ensurePineconeIndex(apiKey: string, indexName: string): Promise<string | null> {
  const API_VERSION = "2025-10";

  // Check if index exists
  try {
    const result = execSync(
      `curl -s -H "Api-Key: ${apiKey}" -H "X-Pinecone-Api-Version: ${API_VERSION}" "https://api.pinecone.io/indexes/${indexName}"`,
      { encoding: "utf-8" }
    );
    const data = JSON.parse(result);
    if (data.host) return data.host;
  } catch {}

  // Create integrated index with embedding model
  console.log(`  Creating Pinecone index '${indexName}'...`);
  try {
    const body = JSON.stringify({
      name: indexName,
      cloud: "aws",
      region: "us-east-1",
      embed: {
        model: "multilingual-e5-large",
        field_map: { text: "content" },
      },
    });
    const result = execSync(
      `curl -s -X POST "https://api.pinecone.io/indexes/create-for-model" ` +
        `-H "Api-Key: ${apiKey}" ` +
        `-H "Content-Type: application/json" ` +
        `-H "X-Pinecone-Api-Version: ${API_VERSION}" ` +
        `-d '${body}'`,
      { encoding: "utf-8" }
    );

    // Wait for index to be ready (up to 60s)
    for (let i = 0; i < 12; i++) {
      execSync("sleep 5", { stdio: "ignore" });
      try {
        const check = execSync(
          `curl -s -H "Api-Key: ${apiKey}" "https://api.pinecone.io/indexes/${indexName}"`,
          { encoding: "utf-8" }
        );
        const checkData = JSON.parse(check);
        if (checkData.status?.ready && checkData.host) {
          console.log(`  ✓ Index '${indexName}' created and ready`);
          return checkData.host;
        }
      } catch {}
      process.stdout.write(".");
    }
    console.log("\n  ⚠ Index created but may not be ready yet. Try again in a minute.");
    return null;
  } catch (err) {
    console.log(`  ✗ Failed to create index: ${err}`);
    return null;
  }
}

async function upsertToPinecone(
  apiKey: string,
  host: string,
  record: { id: string; content: string; type: string; source: string }
): Promise<boolean> {
  try {
    // NDJSON format for integrated index — one record per line
    const ndjson = JSON.stringify({
      _id: record.id,
      content: record.content,
      type: record.type,
      source: record.source,
      timestamp: new Date().toISOString(),
      migrated_from: "openclaw",
    });

    // Write to temp file to avoid shell escaping issues with content
    const tmpFile = join(homedir(), ".zclawd", `upsert-${Date.now()}.ndjson`);
    writeFileSync(tmpFile, ndjson);

    execSync(
      `curl -s -X POST "https://${host}/records/namespaces/default/upsert" ` +
        `-H "Api-Key: ${apiKey}" ` +
        `-H "Content-Type: application/x-ndjson" ` +
        `-H "X-Pinecone-Api-Version: 2025-10" ` +
        `-d @${tmpFile}`,
      { encoding: "utf-8", stdio: "pipe" }
    );

    // Clean up temp file
    try { execSync(`rm -f ${tmpFile}`, { stdio: "ignore" }); } catch {}

    return true;
  } catch {
    return false;
  }
}

async function cmdMigrate(): Promise<void> {
  const openclawPath = process.argv[3] || join(homedir(), ".openclaw");

  if (!existsSync(openclawPath)) {
    console.log(`✗ OpenClaw directory not found: ${openclawPath}`);
    console.log("\nUsage: zclawd migrate [path-to-openclaw-dir]");
    console.log("Default: ~/.openclaw");
    return;
  }

  console.log(`Migrating from OpenClaw: ${openclawPath}\n`);
  const config = loadConfig();
  let migrated = 0;

  // 1. Read openclaw.json
  const openclawJsonPath = join(openclawPath, "openclaw.json");
  let openclawConfig: Record<string, any> = {};
  if (existsSync(openclawJsonPath)) {
    openclawConfig = JSON.parse(readFileSync(openclawJsonPath, "utf-8"));
    console.log("✓ Found openclaw.json");
  } else {
    console.log("⚠ No openclaw.json found — checking clawdbot.json");
    const clawdbotPath = join(openclawPath, "clawdbot.json");
    if (existsSync(clawdbotPath)) {
      openclawConfig = JSON.parse(readFileSync(clawdbotPath, "utf-8"));
      console.log("✓ Found clawdbot.json");
    } else {
      console.log("✗ No config file found in OpenClaw directory.");
      return;
    }
  }

  // 2. Telegram bot token
  const botToken = openclawConfig.channels?.telegram?.botToken;
  if (botToken) {
    console.log(`\n--- Telegram ---`);
    console.log(`  Bot token: ${botToken.substring(0, 10)}...`);

    // Save to ZClawd
    const raw = existsSync(getConfigPath()) ? JSON.parse(readFileSync(getConfigPath(), "utf-8")) : {};
    raw.telegram = { botToken };
    writeFileSync(getConfigPath(), JSON.stringify(raw, null, 2));

    // Write .env
    const telegramDir = join(homedir(), ".claude", "channels", "telegram");
    ensureDir(telegramDir);
    writeFileSync(join(telegramDir, ".env"), `TELEGRAM_BOT_TOKEN=${botToken}\n`, { mode: 0o600 });

    // Enable plugin
    const claudeSettingsPath = join(homedir(), ".claude", "settings.json");
    let cs: Record<string, any> = {};
    if (existsSync(claudeSettingsPath)) cs = JSON.parse(readFileSync(claudeSettingsPath, "utf-8"));
    if (!cs.enabledPlugins) cs.enabledPlugins = {};
    cs.enabledPlugins["telegram@claude-plugins-official"] = true;
    writeFileSync(claudeSettingsPath, JSON.stringify(cs, null, 2));

    // Clear webhooks
    try {
      execSync(`curl -s "https://api.telegram.org/bot${botToken}/deleteWebhook"`, { stdio: "ignore" });
    } catch {}

    console.log("  ✓ Bot token migrated");
    console.log("  ✓ Telegram plugin enabled");
    console.log("  ✓ Webhooks cleared");
    migrated++;
  }

  // 3. Model
  const model = openclawConfig.agents?.defaults?.model?.primary;
  if (model) {
    console.log(`\n--- Model ---`);
    // Convert openclaw format (anthropic/claude-opus-4-6) to claude code format (claude-opus-4-6)
    const cleanModel = model.replace(/^anthropic\//, "");
    const raw = JSON.parse(readFileSync(getConfigPath(), "utf-8"));
    raw.model = cleanModel;
    writeFileSync(getConfigPath(), JSON.stringify(raw, null, 2));
    console.log(`  ✓ Model set to: ${cleanModel}`);
    migrated++;
  }

  // 4. Workspace files (SOUL.md, USER.md, etc.)
  const workspaceDir = openclawConfig.agents?.defaults?.workspace;
  if (workspaceDir && existsSync(workspaceDir)) {
    console.log(`\n--- Personality ---`);
    const claudeMdPath = join(config.workspace, "CLAUDE.md");
    let claudeMd = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, "utf-8") : "";
    let appended = false;

    // Import SOUL.md
    const soulPath = join(workspaceDir, "SOUL.md");
    if (existsSync(soulPath) && !claudeMd.includes("Imported from OpenClaw SOUL.md")) {
      const soul = readFileSync(soulPath, "utf-8");
      claudeMd += `\n\n<!-- Imported from OpenClaw SOUL.md -->\n${soul}`;
      appended = true;
      console.log("  ✓ SOUL.md imported");
    }

    // Import USER.md
    const userPath = join(workspaceDir, "USER.md");
    if (existsSync(userPath) && !claudeMd.includes("Imported from OpenClaw USER.md")) {
      const user = readFileSync(userPath, "utf-8");
      claudeMd += `\n\n<!-- Imported from OpenClaw USER.md -->\n${user}`;
      appended = true;
      console.log("  ✓ USER.md imported");
    }

    // Import TOOLS.md
    const toolsPath = join(workspaceDir, "TOOLS.md");
    if (existsSync(toolsPath) && !claudeMd.includes("Imported from OpenClaw TOOLS.md")) {
      const tools = readFileSync(toolsPath, "utf-8");
      claudeMd += `\n\n<!-- Imported from OpenClaw TOOLS.md -->\n${tools}`;
      appended = true;
      console.log("  ✓ TOOLS.md imported");
    }

    if (appended) {
      writeFileSync(claudeMdPath, claudeMd);
      console.log("  ✓ Appended to CLAUDE.md (your existing content preserved)");
      migrated++;
    }

    // Import memory files to workspace
    const memoryDir = join(workspaceDir, "memory");
    if (existsSync(memoryDir)) {
      const destMemory = join(config.workspace, "memory");
      ensureDir(destMemory);
      try {
        execSync(`cp -rn ${memoryDir}/* ${destMemory}/ 2>/dev/null`, { stdio: "ignore" });
        console.log("  ✓ Memory files copied to workspace");
        migrated++;
      } catch {}
    }

    // Import MEMORY.md
    const memoryMdPath = join(workspaceDir, "MEMORY.md");
    if (existsSync(memoryMdPath)) {
      const dest = join(config.workspace, "MEMORY.md");
      if (!existsSync(dest)) {
        execSync(`cp ${memoryMdPath} ${dest}`);
        console.log("  ✓ MEMORY.md copied to workspace");
        migrated++;
      }
    }

    // Push memories to Pinecone if configured
    const zclawdRaw = existsSync(getConfigPath()) ? JSON.parse(readFileSync(getConfigPath(), "utf-8")) : {};
    if (zclawdRaw.pinecone?.apiKey) {
      console.log(`\n--- Pinecone Memory Import ---`);
      const pineconeKey = zclawdRaw.pinecone.apiKey;
      const indexHost = await ensurePineconeIndex(pineconeKey, "zclawd-memory");

      if (indexHost) {
        let upserted = 0;

        // Upsert MEMORY.md
        if (existsSync(memoryMdPath)) {
          const content = readFileSync(memoryMdPath, "utf-8").trim();
          if (content.length > 10) {
            const ok = await upsertToPinecone(pineconeKey, indexHost, {
              id: "openclaw-memory-md",
              content: content.substring(0, 4000),
              type: "openclaw-import",
              source: "MEMORY.md",
            });
            if (ok) { upserted++; console.log("  ✓ MEMORY.md → Pinecone"); }
          }
        }

        // Upsert SOUL.md as personality reference
        if (existsSync(soulPath)) {
          const content = readFileSync(soulPath, "utf-8").trim();
          const ok = await upsertToPinecone(pineconeKey, indexHost, {
            id: "openclaw-soul",
            content: content.substring(0, 4000),
            type: "openclaw-import",
            source: "SOUL.md",
          });
          if (ok) { upserted++; console.log("  ✓ SOUL.md → Pinecone"); }
        }

        // Upsert USER.md
        if (existsSync(userPath)) {
          const content = readFileSync(userPath, "utf-8").trim();
          const ok = await upsertToPinecone(pineconeKey, indexHost, {
            id: "openclaw-user",
            content: content.substring(0, 4000),
            type: "openclaw-import",
            source: "USER.md",
          });
          if (ok) { upserted++; console.log("  ✓ USER.md → Pinecone"); }
        }

        // Upsert daily memory files
        if (existsSync(memoryDir)) {
          let dailyCount = 0;
          const files = readdirSync(memoryDir).filter((f) => f.endsWith(".md")).slice(-30); // last 30
          for (const file of files) {
            const content = readFileSync(join(memoryDir, file), "utf-8").trim();
            if (content.length < 20) continue;
            const ok = await upsertToPinecone(pineconeKey, indexHost, {
              id: `openclaw-memory-${file.replace(".md", "")}`,
              content: content.substring(0, 4000),
              type: "openclaw-import",
              source: file,
            });
            if (ok) { upserted++; dailyCount++; }
          }
          if (dailyCount > 0) console.log(`  ✓ ${dailyCount} daily memory files → Pinecone`);
        }

        console.log(`  ✓ Total: ${upserted} records upserted to Pinecone`);
        migrated++;
      } else {
        console.log("  ⚠ Could not connect to Pinecone index 'zclawd-memory'");
        console.log("  Create it first via /memory-save in a Claude Code session");
      }
    } else {
      console.log("\n  ⚠ Pinecone not configured — memory files only copied to workspace");
      console.log("  Run 'zclawd pinecone <key>' to enable Pinecone memory");
    }
  }

  // 5. Telegram access (approved senders)
  // OpenClaw stores this differently, but we can check for known patterns
  if (openclawConfig.channels?.telegram) {
    const tgConfig = openclawConfig.channels.telegram;
    if (tgConfig.dmPolicy) {
      console.log(`\n--- Telegram Access ---`);
      console.log(`  DM Policy: ${tgConfig.dmPolicy}`);
      console.log(`  Note: You'll need to re-pair your Telegram account.`);
      console.log(`  Run: zclawd pair`);
    }
  }

  // Summary
  console.log(`\n✅ Migration complete. ${migrated} item(s) migrated.`);
  console.log("\nNext steps:");
  console.log("  1. Run 'zclawd doctor' to verify everything");
  console.log("  2. Run 'zclawd pair' to re-pair your Telegram account");
  console.log("  3. Review ~/zclawd-workspace/CLAUDE.md — customize as needed");
  console.log("  4. Run 'zclawd start' to begin");
}

function cmdExport(): void {
  const config = loadConfig();
  const timestamp = new Date().toISOString().split("T")[0];
  const exportDir = join(homedir(), `zclawd-export-${timestamp}`);
  ensureDir(exportDir);

  console.log(`Exporting ZClawd data to: ${exportDir}\n`);

  // 1. Config
  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    // Strip secrets from exported config
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    const safe = { ...raw };
    if (safe.telegram?.botToken) safe.telegram.botToken = "<REDACTED>";
    if (safe.pinecone?.apiKey) safe.pinecone.apiKey = "<REDACTED>";
    writeFileSync(join(exportDir, "config.json"), JSON.stringify(safe, null, 2));
    console.log("✓ Config exported (secrets redacted)");
  }

  // 2. CLAUDE.md
  const claudeMd = join(config.workspace, "CLAUDE.md");
  if (existsSync(claudeMd)) {
    copyFileSync(claudeMd, join(exportDir, "CLAUDE.md"));
    console.log("✓ CLAUDE.md exported");
  }

  // 3. Skills
  const skillsDir = join(homedir(), ".claude", "skills");
  const exportSkills = join(exportDir, "skills");
  ensureDir(exportSkills);
  for (const skill of ["heartbeat.md", "memory-save.md", "memory-load.md", "status.md"]) {
    const src = join(skillsDir, skill);
    if (existsSync(src)) {
      copyFileSync(src, join(exportSkills, skill));
    }
  }
  console.log("✓ Skills exported");

  // 4. Memory files
  const memoryDir = join(config.workspace, "memory");
  if (existsSync(memoryDir)) {
    try {
      execSync(`cp -r ${memoryDir} ${join(exportDir, "memory")}`);
      console.log("✓ Memory files exported");
    } catch {}
  }

  // 5. MEMORY.md
  const memoryMd = join(config.workspace, "MEMORY.md");
  if (existsSync(memoryMd)) {
    copyFileSync(memoryMd, join(exportDir, "MEMORY.md"));
    console.log("✓ MEMORY.md exported");
  }

  // 6. Telegram access
  const accessPath = join(homedir(), ".claude", "channels", "telegram", "access.json");
  if (existsSync(accessPath)) {
    copyFileSync(accessPath, join(exportDir, "telegram-access.json"));
    console.log("✓ Telegram access exported");
  }

  // 7. State
  const statePath = join(ZCLAWD_DIR, "state.json");
  if (existsSync(statePath)) {
    copyFileSync(statePath, join(exportDir, "state.json"));
    console.log("✓ State exported");
  }

  console.log(`\n✅ Export complete: ${exportDir}`);
  console.log("Note: Bot tokens and API keys are redacted. Re-configure after import.");
}

// --- Main ---
const cmd = process.argv[2];

switch (cmd) {
  case "setup":
    cmdSetup();
    break;
  case "start":
    cmdStart();
    break;
  case "start-fg":
  case "foreground":
    cmdStartForeground();
    break;
  case "stop":
    cmdStop();
    break;
  case "restart":
    cmdRestart();
    break;
  case "status":
    cmdStatus();
    break;
  case "logs":
    cmdLogs();
    break;
  case "config":
    cmdConfig();
    break;
  case "reset":
    cmdReset();
    break;
  case "install":
    cmdInstall();
    break;
  case "uninstall":
    cmdUninstall();
    break;
  case "auth":
  case "login":
    cmdAuth();
    break;
  case "telegram":
    cmdTelegram();
    break;
  case "pinecone":
    cmdPinecone();
    break;
  case "model":
    cmdModel();
    break;
  case "pair":
    cmdPair();
    break;
  case "doctor":
    cmdDoctor();
    break;
  case "migrate":
  case "import":
    cmdMigrate().catch((e) => { console.error(e); process.exit(1); });
    break;
  case "export":
  case "backup":
    cmdExport();
    break;
  default:
    printHelp();
}
