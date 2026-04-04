# Changelog

## v0.1.0-beta (2026-04-04)

Initial release.

### Features
- Process supervision with PTY, auto-restart, session resume (`--resume`)
- Telegram bot integration via Claude Code native plugin (`--channels`)
- Pinecone long-term memory (integrated index with `multilingual-e5-large` embeddings)
- Cron-based reminders system
- OpenClaw migration (`zclawd migrate`) — imports config, personality, memories to Pinecone
- Doctor command — auto-diagnoses and fixes issues
- Systemd service for auto-start on boot
- Stale session auto-recovery
- Pre-flight checks on start (auth, trust, Telegram, Pinecone)
- Export/backup command
- 29 unit tests

### CLI Commands
`setup` `start` `stop` `restart` `foreground` `status` `logs` `config` `reset` `auth` `model` `telegram` `pinecone` `pair` `doctor` `reminders` `migrate` `export` `install` `uninstall`
