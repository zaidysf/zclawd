---
name: sidecar
description: Interact with the ZClawd sidecar — restart sessions, check status, manage reminders, save/load memory. Use when Claude needs to do things it can't do from inside the session.
---

# ZClawd Sidecar Commands

You are running inside a ZClawd-managed Claude Code session. The ZClawd sidecar supervises your process and provides capabilities you can't do yourself.

## Available commands

Run these via Bash. They interact with the sidecar and your session.

### Restart yourself
When you need a fresh session (plugin issues, stale context, user asks to restart):
```bash
# Schedule a restart — stops current session, sidecar auto-restarts
zclawd restart &
```
**Note:** This will kill your current process. The sidecar will restart you with a new session. Tell the user you're restarting before running this.

### Check your status
```bash
zclawd status
```
Returns: session ID, PID, uptime, restart count, last heartbeat.

### View logs
```bash
zclawd logs
```

### Manage reminders

**List all reminders:**
```bash
zclawd reminders
```

**Add a reminder** (write directly to the file):
```bash
# Read current reminders
cat ~/.zclawd/reminders.json

# Write updated reminders (add your new one)
# Use proper JSON with: id, schedule (cron), prompt, chatId, createdAt, lastRun
```

The reminder file is at `~/.zclawd/reminders.json`. Format:
```json
[
  {
    "id": "unique-id",
    "schedule": "0 8 * * *",
    "prompt": "Summarize emails and send to Telegram chat 1049692111",
    "chatId": "1049692111",
    "createdAt": "2026-04-04T10:00:00Z",
    "lastRun": null
  }
]
```

Cron format: `minute hour dayOfMonth month dayOfWeek`
- `0 8 * * *` — every day at 8:00 AM
- `0 9 * * 1-5` — weekdays at 9:00 AM
- `*/30 * * * *` — every 30 minutes
- `0 8,20 * * *` — 8 AM and 8 PM

**Remove a reminder:**
```bash
zclawd reminders rm <id>
```

**Clear all reminders:**
```bash
zclawd reminders clear
```

### Memory operations

**Save to Pinecone** (use the Pinecone MCP tools directly):
Use the `upsert-records` tool to save to the `zclawd-memory` index.

**Load from Pinecone**:
Use the `search-records` tool to query the `zclawd-memory` index.

### Export/backup
```bash
zclawd export
```
Creates a backup at `~/zclawd-export-YYYY-MM-DD/`.

### Doctor (check health)
```bash
zclawd doctor
```

## When to use these

- User says "restart" or "reboot" → `zclawd restart &`
- User says "what reminders do I have" → `zclawd reminders`
- User says "remind me every morning to..." → write to reminders.json
- User says "how long have you been running" → `zclawd status`
- User says "check your health" → `zclawd doctor`
- User says "back up your data" → `zclawd export`
- Something feels broken → `zclawd doctor` first, then `zclawd restart &` if needed

## Important

- Always warn the user before restarting ("I'm going to restart, back in a moment")
- After restart, you wake up in a fresh session — load context from Pinecone with `/memory-load`
- The sidecar handles the restart — you don't need to worry about the process lifecycle
