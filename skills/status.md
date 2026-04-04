---
name: status
description: Report ZClawd session health — uptime, session info, last heartbeat, memory stats.
---

# /status

Report current ZClawd session health.

## Check and report:

1. **Session info** — Read `~/.zclawd/state.json` for:
   - Session ID
   - Started at / uptime
   - Restart count
   - Last heartbeat time

2. **Memory stats** — Query Pinecone `zclawd-memory` index:
   - Total records stored
   - Most recent memory timestamp

3. **System** — Basic system info:
   - Current time
   - Disk usage (df -h /)

## Output format:

```
ZClawd Status
  Session:    {id} (up {duration})
  Restarts:   {count}
  Heartbeat:  {last heartbeat time or "never"}
  Memories:   {count} records, latest: {timestamp}
  System:     {disk usage summary}
```
