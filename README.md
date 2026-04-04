<p align="center">
  <img src="logo.jpg" alt="ZClawd" width="120" />
</p>

<h1 align="center">ZClawd</h1>

<p align="center">
  <strong>Always-on AI assistant powered by Claude Code — for Claude enthusiasts who lost OpenClaw.</strong>
  <br />
  <em>Early release — functional and tested, but expect rough edges. PRs welcome.</em>
</p>

---

On April 4, 2026, Anthropic [cut off Claude subscriptions from working with OpenClaw and third-party agents](https://venturebeat.com/technology/anthropic-cuts-off-the-ability-to-use-claude-subscriptions-with-openclaw-and). If you were an OpenClaw user who relied on Claude, you were left without your always-on assistant overnight.

ZClawd is a lightweight, open-source alternative that works **natively with Claude Code** — Anthropic's own tool. No third-party wrappers, no subscription conflicts, no API cost surprises. Just Claude Code, kept alive and made smarter.

## Status

**Working and usable today.** Core features are tested and functional:

- [x] Process supervision with PTY + auto-restart
- [x] Telegram integration via `--channels` flag
- [x] Session resume on crash (`--resume`)
- [x] Stale session auto-recovery
- [x] Pinecone long-term memory (integrated index with embeddings)
- [x] OpenClaw migration (config, personality, memory → Pinecone)
- [x] Doctor command (auto-diagnose + fix)
- [x] Systemd service for auto-start on boot
- [x] Reminders / scheduled prompts (cron-based)
- [x] 29 unit tests passing

**Known limitations:**
- Log output still contains some terminal escape noise (cosmetic)
- Telegram responses may occasionally need a session restart
- Only tested on Ubuntu/Debian with Claude Max subscription

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
- **Reminders** — cron-based scheduled prompts ("remind me every morning to summarize emails")
- **Heartbeat system** — periodic check-ins for proactive behavior
- **Model switching** — change Claude models on the fly
- **Doctor command** — validates everything (deps, auth, plugins, CLAUDE.md) and auto-fixes
- **OpenClaw migration** — import config, personality, and memories in one command
- **Custom skills** — `/heartbeat`, `/memory-save`, `/memory-load`, `/status`, `/remind`
- **Systemd service** — auto-start on boot, runs forever

## 1. Server Prerequisites

Run as root or with sudo:

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
zclawd setup                     # Config, skills, workspace, trust
zclawd auth                      # Authenticate Claude Code
zclawd model claude-opus-4-6     # Choose model
zclawd telegram <bot-token>      # Configure Telegram (required)
zclawd pinecone <api-key>        # Configure Pinecone memory (optional)
```

## 4. Pair Telegram

```bash
# Send a message to your bot on Telegram, then:
zclawd pair

# Or directly with your Telegram user ID:
zclawd pair <your-telegram-user-id>
```

## 5. Verify

```bash
zclawd doctor     # Check everything, auto-fix issues
zclawd foreground # Run in foreground to verify (Ctrl+C to stop)
```

## 6. Start

```bash
zclawd start      # Background daemon
zclawd status     # Verify it's running
zclawd logs       # Check output
```

### Auto-start on boot

```bash
sudo zclawd install           # Install systemd service
sudo systemctl start zclawd   # Start
journalctl -u zclawd -f       # View logs
```

## Reminders

Tell your bot via Telegram:
- "Remind me every morning at 8am to summarize my emails"
- "Every weekday at 9am send me the latest AI news"
- "Check my calendar every hour"

Claude saves reminders to `~/.zclawd/reminders.json`. The sidecar checks every 60 seconds and sends due prompts to the Claude session, which processes them (fetch news, read emails, etc.) and responds via Telegram.

Manage via CLI:
```bash
zclawd reminders              # List all
zclawd reminders rm <id>      # Remove one
zclawd reminders clear        # Remove all
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

Reminders:
  reminders         List all reminders
  reminders rm <id> Remove a reminder
  reminders clear   Remove all reminders

Migration:
  migrate [path]    Import from OpenClaw (~/.openclaw by default)
  export            Export config, memory, skills for backup

Service:
  install           Install systemd service (auto-start on boot)
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
│  - reminders     │     │   - Custom skills         │
│  - auto-restart  │     │   - Pinecone memory       │
│  - --resume {id} │     │                           │
└──────────────────┘     └─────────────────────────┘
```

### Key design decisions

- **PTY, not pipes** — Claude Code's plugins (Telegram, MCP) require a real terminal. `node-pty` provides this.
- **`--channels` flag** — Required for Telegram to forward messages to the session. ZClawd adds it automatically.
- **Session resume** — Session ID read from `~/.claude/sessions/{pid}.json`. On crash, `--resume <id>` restores context.
- **Stale session recovery** — If "No conversation found", auto-resets and starts fresh instead of looping.
- **CLAUDE.md auto-repair** — `zclawd doctor` ensures required sections (Telegram reply rules, memory, heartbeat) exist without overwriting customizations.
- **Pinecone integrated index** — Created via `/indexes/create-for-model` API with `multilingual-e5-large` embeddings. Records upserted as NDJSON via `/records` endpoint.

## Skills

| Skill | Description |
|---|---|
| `/heartbeat` | Periodic check triggered by supervisor. Saves summaries to Pinecone. |
| `/memory-save` | Save session context to Pinecone. |
| `/memory-load` | Pull recent context from Pinecone after restart. |
| `/status` | Report session health and memory stats. |
| `/remind` | Set, list, or delete scheduled reminders. |

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

## Migrating from OpenClaw

```bash
zclawd migrate                    # Auto-detect ~/.openclaw
zclawd migrate /path/to/.openclaw # Custom path
```

Imports: Telegram token, model, personality (SOUL.md, USER.md, TOOLS.md → CLAUDE.md), memory files → Pinecone, webhooks cleared.

```bash
zclawd doctor   # Verify
zclawd pair     # Re-pair Telegram
zclawd start    # Go
```

## Troubleshooting

**Run `zclawd doctor` first** — it catches and fixes most issues automatically.

| Problem | Fix |
|---|---|
| Must run as non-root | `sudo useradd -m -s /bin/bash zclawd-user` |
| npm install fails (node-pty) | `sudo apt install -y build-essential python3` |
| Telegram MCP failed | Bun not installed — `zclawd doctor` auto-installs |
| Pinecone MCP failed | Run `zclawd pinecone <key>` |
| Typing but no response | `zclawd doctor` (fixes CLAUDE.md) + `zclawd restart` |
| Session keeps restarting | Stale session — auto-recovers, or `zclawd reset && zclawd start` |
| Noisy logs | Terminal escape sequences — cosmetic only |

## Contributing

This project is in early development. Contributions welcome:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit and push
6. Open a PR against `main`

**Areas that need help:**
- Cleaner log output (better ANSI stripping)
- WhatsApp/Discord channel support
- Web dashboard for status/reminders
- Better error messages
- CI/CD pipeline
- More test coverage

**Reporting bugs:** [Open an issue](https://github.com/zaidysf/zclawd/issues) with:
- `zclawd doctor` output
- `zclawd logs` output
- Steps to reproduce

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
