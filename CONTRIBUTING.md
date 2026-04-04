# Contributing to ZClawd

Thanks for your interest in contributing! ZClawd is in early development and we welcome help.

## Getting Started

```bash
git clone https://github.com/zaidysf/zclawd.git
cd zclawd
npm install
npm run build
npm test
```

## Development

```bash
# Run in dev mode
npm run dev

# Build
npm run build

# Run tests
npm test

# Test the CLI
node dist/cli.js doctor
```

## Project Structure

```
src/
  cli.ts          — CLI commands (setup, start, doctor, migrate, etc.)
  supervisor.ts   — Process manager (PTY, restart, heartbeat, reminders)
  config.ts       — Config loading from ~/.zclawd/config.json
  state.ts        — Session state persistence
  reminders.ts    — Cron-based reminder system
  logger.ts       — File + console logging
  index.ts        — Entry point for supervisor daemon

skills/           — Custom skills installed into Claude Code
templates/        — CLAUDE.md template for new workspaces
tests/            — Unit tests (Node.js test runner)
```

## Adding a New Skill

1. Create `skills/your-skill.md` with frontmatter:
   ```markdown
   ---
   name: your-skill
   description: What it does
   ---
   # /your-skill
   Instructions for Claude...
   ```
2. The skill gets installed to `~/.claude/skills/` on `zclawd setup`

## Adding a New CLI Command

1. Add the function in `src/cli.ts`
2. Add to the switch statement at the bottom
3. Add to `printHelp()`
4. Add a test in `tests/cli.test.js`

## Code Style

- TypeScript, ESM modules
- No external dependencies unless absolutely necessary
- Use Node.js built-in test runner (no Jest/Mocha)
- Keep it simple — this is a thin wrapper, not a framework

## Pull Requests

- Branch from `main`
- Run `npm run build && npm test` before submitting
- Keep PRs focused — one feature or fix per PR
- Update README if you add user-facing features

## Areas That Need Help

- Cleaner log output (better ANSI escape stripping)
- WhatsApp / Discord channel support
- Web dashboard for status and reminders
- More test coverage
- CI/CD improvements
- Documentation
