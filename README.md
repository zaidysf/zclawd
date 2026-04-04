<p align="center">
  <img src="logo.jpg" alt="ZClawd" width="120" />
</p>

<h1 align="center">ZClawd</h1>

<p align="center"><strong>Always-on AI assistant powered by Claude Code — for Claude enthusiasts who lost OpenClaw.</strong></p>

On April 4, 2026, Anthropic [cut off Claude subscriptions from working with OpenClaw and third-party agents](https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and). If you were an OpenClaw user who relied on Claude, you were left without your always-on assistant overnight.

ZClawd is a lightweight, open-source alternative that works **natively with Claude Code** — Anthropic's own tool. No third-party wrappers, no subscription conflicts, no API cost surprises. Just Claude Code, kept alive and made smarter.

## Why Not Just OpenClaw?

| | OpenClaw | ZClawd |
|---|---|---|
| Subscription support | Banned by Anthropic | Uses Claude Code natively |
| Security | CVE-2026-25253, malicious skills | Runs Anthropic's own tool |
| Architecture | Custom agent framework | Thin wrapper around Claude Code |
| Plugins | ClawHub (12% malicious) | Claude Code official plugins |
| Cost | $1K-$5K/day API estimate | Your existing Claude subscription |
| Setup | Heavy | `zclawd setup && zclawd start` |

## What It Does

ZClawd is a thin supervisor that turns Claude Code into an always-on personal assistant:

- **Process supervision** — spawns Claude Code in a real PTY with `--channels` flag for Telegram
- **Smart recovery** — detects stale sessions and auto-resets instead of looping
- **Telegram integration** — chat from anywhere via Claude Code's native Telegram plugin
- **Long-term memory** — saves and loads context via Pinecone across sessions
- **Heartbeat system** — periodic check-ins for proactive behavior
- **Model switching** — change Claude models on the fly
- **Doctor command** — validates everything (deps, auth, plugins, CLAUDE.md) and auto-fixes
- **Custom skills** — `/heartbeat`, `/memory-save`, `/memory-load`, `/status`
- **Systemd service** — auto-start on boot, runs forever

## 1. Server Prerequisites

Your server needs these installed first. Run as root or with sudo:

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install -y build-essential python3 unzip curl git

# Create a non-root user (if you don't have one)
sudo useradd -m -s /bin/bash zclawd-user
sudo su - zclawd-user
```

As the non-root user:

```bash
# Install Node.js 18+ (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 22

# Install Bun (required by Telegram plugin)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install Claude Code
npm install -g @anthropic-ai/claude-code@latest
```

> **Important:** Claude Code blocks `--dangerously-skip-permissions` as root. You must run ZClawd as a non-root user.

## 2. Install ZClawd

```bash
git clone https://github.com/zaidysf/zclawd.git
cd zclawd
npm install
npm run build
npm link
```

## 3. Setup

```bash
# Initialize config, skills, workspace, and trust
zclawd setup

# Authenticate Claude Code
zclawd auth

# Choose your model
zclawd model claude-opus-4-6

# Configure Telegram (required — validates token, writes .env, clears webhooks)
zclawd telegram <your-bot-token>

# Configure Pinecone for long-term memory (optional)
zclawd pinecone <your-api-key>
```

### What `zclawd setup` does:

1. Creates `~/.zclawd/` data directory with default config
2. Creates `~/zclawd-workspace/` with a CLAUDE.md template (personality + behavior rules)
3. Installs custom skills into `~/.claude/skills/`
4. Trusts the workspace in Claude Code (skips "trust this folder?" dialog)
5. Verifies Claude Code is installed

## 4. Pair Telegram

After configuring the bot token, pair your Telegram account:

```bash
# Option A: Auto-pair (send a message to your bot first, then run this)
zclawd pair

# Option B: Direct pair with your Telegram user ID
zclawd pair <your-telegram-user-id>
```

## 5. Run Doctor

Verify everything is ready:

```bash
zclawd doctor
```

Doctor checks and auto-fixes:
- Node.js, Bun, Claude Code installed
- Non-root user
- Authentication
- Workspace trusted
- Skills installed
- Telegram token valid, .env exists
- Pinecone configured
- CLAUDE.md has all required sections (adds missing ones without overwriting your customizations)

## 6. Start

```bash
# First time — run in foreground to verify
zclawd foreground

# Once confirmed, Ctrl+C and start as background daemon
zclawd start

# Verify
zclawd status
zclawd logs
```

Message your bot on Telegram — it should respond.

## Running

```bash
zclawd start       # Start background daemon
zclawd stop        # Stop
zclawd restart     # Stop + start
zclawd status      # Show session health
zclawd logs        # View today's logs
zclawd reset       # Clear session ID, start fresh
zclawd foreground  # Run in foreground (debugging)
```

### Auto-start on boot (systemd)

```bash
sudo zclawd install       # Install service
sudo systemctl start zclawd
journalctl -u zclawd -f   # View logs
sudo zclawd uninstall     # Remove service
```

## CLI Reference

```
Commands:
  setup             Initialize config, workspace, skills, trust, CLAUDE.md
  start             Start supervisor (runs pre-flight checks)
  stop              Stop supervisor
  restart           Stop + start
  foreground        Run in foreground (debugging/first run)
  status            Show session health
  logs              View today's logs
  config            Print configuration
  reset             Clear session ID

Configuration:
  auth              Authenticate Claude Code
  model <name>      Set model (claude-opus-4-6, claude-sonnet-4-6, claude-haiku-4-5)
  telegram <token>  Configure Telegram (validates, writes .env, clears webhooks)
  pinecone <key>    Configure Pinecone API key
  pair [sender-id]  Pair Telegram account (auto-detect or direct ID)
  doctor            Check + fix everything

Migration:
  migrate [path]    Import from OpenClaw (~/.openclaw by default)
  export            Export config, memory, skills for backup

Service:
  install           Install systemd service
  uninstall         Remove systemd service
```

## How It Works

```
┌──────────────────┐     ┌─────────────────────────┐
│   ZClawd          │     │   Claude Code (PTY)      │
│   Supervisor      │────▶│   --channels telegram    │
│                  │     │   --dangerously-skip...  │
│  - spawn in PTY  │     │   - Telegram plugin       │
│  - health check  │     │   - All official plugins  │
│  - heartbeat     │     │   - MCP servers           │
│  - auto-restart  │     │   - Custom skills         │
│  - --resume {id} │     │   - Pinecone memory       │
└──────────────────┘     └─────────────────────────┘
```

### Why PTY?

Claude Code is an interactive terminal app. Its plugins (Telegram, MCP servers) require a real terminal. ZClawd uses `node-pty` to spawn Claude Code in a pseudo-terminal so all features work.

### The `--channels` flag

The Telegram plugin requires `--channels plugin:telegram@claude-plugins-official` to actually forward messages to the session. Without it, the MCP server starts but messages don't reach Claude. ZClawd adds this flag automatically when Telegram is configured.

### Session persistence

ZClawd reads the session ID from `~/.claude/sessions/{pid}.json`. On crash, it restarts with `--resume <session-id>`. If the session is stale ("No conversation found"), it auto-resets and starts fresh.

### CLAUDE.md

The workspace CLAUDE.md defines Claude's personality and behavior. `zclawd doctor` ensures it contains required sections (Telegram reply rules, memory instructions, heartbeat behavior) without overwriting your customizations.

### Long-term memory

Pinecone preserves context when the conversation window compresses. The API key is injected into the process environment automatically. Bun path is also added to PATH so the Telegram MCP server can start.

## Skills

| Skill | Description |
|---|---|
| `/heartbeat` | Periodic check triggered by supervisor. Saves summaries to Pinecone. |
| `/memory-save` | Save session context to Pinecone. |
| `/memory-load` | Pull recent context from Pinecone after restart. |
| `/status` | Report session health and memory stats. |

## Configuration

Config: `~/.zclawd/config.json`

| Key | Default | Description |
|---|---|---|
| `workspace` | `~/zclawd-workspace` | Working directory |
| `claudeBin` | `~/.local/bin/claude` | Claude Code binary path |
| `model` | _(default)_ | Claude model |
| `heartbeatIntervalMs` | `3600000` (1h) | Heartbeat interval |
| `restartDelayMs` | `5000` | Restart delay after crash |
| `maxRestarts` | `50` | Max restarts before 60s backoff |
| `telegram.botToken` | _(required)_ | Telegram bot token |
| `pinecone.apiKey` | _(optional)_ | Pinecone API key |

## For OpenClaw Users

**What's covered:**
- Always-on daemon with auto-restart and session resume
- Telegram bot (via Claude Code's native plugin + `--channels` flag)
- Persistent memory (Pinecone)
- Heartbeat/proactive checks
- Smart recovery (stale session auto-reset)

**What's different:**
- No ClawHub (uses Claude Code's official plugin ecosystem)
- No multi-model fallback (single model, switchable via `zclawd model`)
- No gateway API (access via Telegram or SSH)

The key advantage: runs on Anthropic's native tooling — won't get banned.

### Migrating from OpenClaw

```bash
# Auto-detect OpenClaw at ~/.openclaw
zclawd migrate

# Or specify path
zclawd migrate /path/to/.openclaw
```

`zclawd migrate` imports:
- **Telegram bot token** → configured in ZClawd + plugin enabled
- **Model preference** → `anthropic/claude-opus-4-6` → `claude-opus-4-6`
- **Personality** → `SOUL.md`, `USER.md`, `TOOLS.md` appended to `CLAUDE.md` (your existing content preserved)
- **Memory files** → daily logs + `MEMORY.md` copied to workspace
- **Webhooks cleared** → prevents conflicts with old OpenClaw sessions

After migrating:
1. `zclawd doctor` — verify everything
2. `zclawd pair` — re-pair your Telegram (sender IDs don't transfer)
3. `zclawd start` — you're live

### Backing up ZClawd

```bash
zclawd export
```

Exports config, CLAUDE.md, skills, memory, and Telegram access to `~/zclawd-export-YYYY-MM-DD/`. Secrets are redacted.

## Troubleshooting

### Run `zclawd doctor` first
It catches and fixes most issues automatically.

### "Must run as non-root"
Create a user: `sudo useradd -m -s /bin/bash zclawd-user`

### "npm install fails" (node-pty)
`sudo apt install -y build-essential python3`

### "MCP server failed"
- **Telegram:** Bun not installed or not in PATH. `zclawd doctor` fixes this.
- **Pinecone:** API key missing. Run `zclawd pinecone <key>`.

### Telegram shows "typing" but no response
- Make sure `--channels` flag is being passed (ZClawd does this automatically when Telegram is configured)
- Run `zclawd doctor` to ensure CLAUDE.md has the Telegram reply instructions
- Restart: `zclawd stop && zclawd reset && zclawd start`

### Session keeps restarting
Stale session ID — ZClawd auto-resets this. If it persists: `zclawd reset && zclawd start`

### Noisy logs
Terminal escape sequences from Claude Code's UI. Cosmetic only.

## Requirements Summary

| Dependency | Required | Installed by |
|---|---|---|
| Node.js 18+ | Yes | nvm |
| Bun | Yes (Telegram) | `zclawd doctor` auto-installs |
| build-essential | Yes (node-pty) | apt |
| Claude Code v2.1.90+ | Yes | npm |
| Claude subscription | Yes (Pro/Max/Team) | anthropic.com |
| Telegram bot token | Yes | @BotFather |
| Pinecone API key | No | pinecone.io |

## Disclaimer

This project is **not affiliated with, endorsed by, or associated with Anthropic** in any way. ZClawd is an independent, community-built tool that wraps Claude Code. Use it at your own risk.

- No warranty of any kind — use as-is
- Your Claude subscription usage is your responsibility
- API costs, rate limits, and account standing are between you and Anthropic
- The authors are not responsible for any damages, data loss, or account issues
- Anthropic's terms of service apply to your use of Claude Code

## Support the Project

If ZClawd saved you from the OpenClaw apocalypse, consider buying me a coffee:

<a href="https://buymeacoffee.com/zaidysf" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="200" /></a>

## License

MIT
