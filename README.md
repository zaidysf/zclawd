<p align="center">
  <img src="logo.jpg" alt="ZClawd" width="120" />
</p>

<h1 align="center">ZClawd</h1>

<p align="center">
  <strong>Always-on AI assistant powered by Claude Code — for Claude enthusiasts who lost OpenClaw.</strong>
  <br />
  <em>Early release — functional and tested, but expect rough edges. PRs welcome.</em>
</p>

<p align="center">
  <a href="https://github.com/zaidysf/zclawd/actions"><img src="https://github.com/zaidysf/zclawd/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/zaidysf/zclawd/releases"><img src="https://img.shields.io/github/v/release/zaidysf/zclawd?include_prereleases" alt="Release" /></a>
  <a href="https://github.com/zaidysf/zclawd/blob/main/LICENSE"><img src="https://img.shields.io/github/license/zaidysf/zclawd" alt="License" /></a>
  <a href="https://github.com/zaidysf/zclawd/stargazers"><img src="https://img.shields.io/github/stars/zaidysf/zclawd" alt="Stars" /></a>
  <a href="https://paypal.me/unclezstudio"><img src="https://img.shields.io/badge/paypal-donate-blue" alt="Donate via PayPal" /></a>
</p>

---

```
$ zclawd setup

  ZClawd Setup Wizard

Checking prerequisites...
  ✓ Node.js v24.11.0
  ✓ User: zaid
  ✓ Bun installed

Step 1/7: Core setup...
  ✓ Config, workspace, skills, trust — all set

Step 2/7: Claude Code...
  ✓ Found: 2.1.92 (Claude Code)
  ✓ Authenticated

Step 3/7: Model...
  Which model? claude-opus-4-6
  ✓ Model: claude-opus-4-6

Step 4/7: Telegram (required)...
  Bot token: 8597886***
  ✓ Bot verified: @uncle_zarvis_bot
  ✓ Telegram configured

Step 5/7: Pinecone (optional)...
  ✓ Index 'zclawd-memory' created and ready

Step 6/7: OpenClaw migration...
  ✓ Found OpenClaw at ~/.openclaw
  ✓ Bot token migrated
  ✓ MEMORY.md → Pinecone (15 sections)
  ✓ 60 daily memory files → Pinecone
  ✓ 3 scripts → Pinecone

Step 7/7: Pair Telegram...
  ✓ Already paired (1 user)

✅ Setup complete!

$ zclawd start
ZClawd started (PID: 2243785)
```

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
- [x] Sidecar skill (Claude can restart itself, check status, manage reminders)
- [x] Telegram notifications on start/restart/boot
- [x] Interactive setup wizard (one command from zero to running)
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

## 1. Prerequisites

```bash
# Debian/Ubuntu (as root)
sudo apt update && sudo apt install -y build-essential python3 unzip curl git

# Create a non-root user if needed (Claude Code won't run as root)
sudo useradd -m -s /bin/bash zclawd-user && sudo su - zclawd-user

# Install Node.js 20+ (as your user)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc && nvm install 22

# Install Claude Code
npm install -g @anthropic-ai/claude-code@latest
```

> Bun is also required but `zclawd setup` will auto-install it if missing.

## 2. Install ZClawd

```bash
git clone https://github.com/zaidysf/zclawd.git
cd zclawd
npm install && npm run build && npm link
```

## 3. Setup (interactive wizard)

```bash
zclawd setup
```

The wizard handles everything in one command:

1. **Prerequisites** — checks Node 20+, non-root, Bun (auto-installs if missing)
2. **Claude Code** — detects installation, prompts authentication
3. **Model** — choose your Claude model
4. **Telegram** — paste your bot token, validates, configures plugin
5. **Pinecone** — optional long-term memory, creates integrated index
6. **OpenClaw migration** — auto-detects `~/.openclaw`, imports config, personality, and all memories to Pinecone
7. **Telegram pairing** — pairs your Telegram account

After the wizard, verify and start:

```bash
zclawd doctor       # Verify everything (auto-fixes issues)
zclawd foreground   # Test run (Ctrl+C to stop)
zclawd start        # Start as background daemon
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
| `/remind` | Set, list, or delete scheduled reminders (cron-based). |
| `/sidecar` | Interact with ZClawd — restart, check status, manage reminders from inside the session. |

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

If ZClawd saved you from the OpenClaw apocalypse, consider sending a tip:

<a href="https://paypal.me/unclezstudio" target="_blank"><img src="https://img.shields.io/badge/paypal-donate-blue?style=for-the-badge&logo=paypal" alt="Donate via PayPal" /></a>

paypal.me/unclezstudio

## Author

Built by [Zaid Yasyaf](https://uncle-z.com) — [@zaidysf](https://github.com/zaidysf)

## License

MIT
