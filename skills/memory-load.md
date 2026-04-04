---
name: memory-load
description: Load recent context from Pinecone to restore memory after session restart or context compression.
---

# /memory-load

Pull recent context from Pinecone to restore your memory.

## When to use:

- On session startup (fresh session or after restart)
- When conversation context feels stale or compressed
- When you need to recall something from a previous session

## How to load:

1. Query the Pinecone `zclawd-memory` index with a broad query like "recent session context and decisions"
2. Request top 10 results, sorted by recency
3. Read through the returned summaries
4. Internalize the context — you now know what happened recently

## After loading:

Briefly acknowledge what you recalled:
- "Loaded context from [N] recent sessions. Last activity: [summary]"
- If nothing found: "No prior memory found. Starting fresh."

Do NOT dump the raw results to the user. Summarize naturally.
