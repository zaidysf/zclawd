---
name: memory-save
description: Save current session context and summary to Pinecone for long-term memory persistence.
---

# /memory-save

Save the current session's important context to Pinecone.

## What to save:

Create a concise summary of the current session that includes:
- **What was discussed** — key topics and decisions
- **What was done** — completed tasks, files changed, commands run
- **What's pending** — unfinished work, next steps
- **User preferences** — any new preferences or corrections learned
- **Important context** — anything that would help a future session pick up seamlessly

## How to save:

Use the Pinecone MCP tools to upsert a record to the `zclawd-memory` index:

1. Create a text summary (under 2000 chars)
2. Include metadata:
   - `type`: "session-summary" | "decision" | "preference" | "task"
   - `timestamp`: ISO date string
   - `session_id`: current session ID if known
3. Upsert to Pinecone index `zclawd-memory`

## After saving:

Confirm what was saved with a brief one-liner.
