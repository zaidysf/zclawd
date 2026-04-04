---
name: heartbeat
description: Periodic health check triggered by ZClawd sidecar. Checks pending items and saves session summary.
---

# /heartbeat

You received a periodic heartbeat from the ZClawd sidecar.

## Do these checks:

1. **Session summary** — Has significant work been done since the last heartbeat? If yes, run `/memory-save` to persist context to Pinecone.

2. **Pending tasks** — Are there any tasks you were working on that need follow-up?

3. **Time awareness** — Note the current time. If it's late night (23:00-08:00), keep it brief unless something is urgent.

## Response:

- If nothing notable: reply `HEARTBEAT_OK`
- If there's something to report: briefly state what happened and any action needed
- If you saved memory: mention it

Keep it short. This runs hourly.
