---
name: remind
description: Set up recurring or one-time reminders. The sidecar checks every minute and sends the prompt back to you when due.
---

# /remind

Manage reminders that execute on a schedule. The ZClawd sidecar checks every 60 seconds and sends the reminder prompt to your session when due.

## Setting a reminder

When the user asks to be reminded of something, save it to `~/.zclawd/reminders.json`.

### File format

```json
[
  {
    "id": "unique-id",
    "schedule": "0 8 * * *",
    "prompt": "Summarize my unread emails and send to Telegram",
    "chatId": "user-telegram-chat-id",
    "createdAt": "2026-04-04T10:00:00Z",
    "lastRun": null
  }
]
```

### Schedule format (cron)

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)  
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, 0=Sunday)
│ │ │ │ │
* * * * *
```

Common patterns:
- `0 8 * * *` — every day at 8:00 AM
- `0 8 * * 1-5` — weekdays at 8:00 AM
- `0 9 * * 1` — every Monday at 9:00 AM
- `*/30 * * * *` — every 30 minutes
- `0 8,20 * * *` — at 8:00 AM and 8:00 PM

### The prompt field

This is what gets sent to your Claude session when the reminder fires. Write it as a complete instruction:
- "Summarize my unread emails and send the summary to Telegram chat 1049692111"
- "Check the latest tech news about AI and send a brief summary to Telegram chat 1049692111"
- "Check the weather for Jakarta and send it to Telegram chat 1049692111"

**IMPORTANT:** Always include "send to Telegram chat {chatId}" in the prompt so Claude knows to respond via Telegram.

## How to use

When user says something like:
- "remind me every morning at 8am to summarize emails" → schedule: `0 8 * * *`
- "every weekday at 9am send me the news" → schedule: `0 9 * * 1-5`
- "check my calendar every hour" → schedule: `0 * * * *`

Steps:
1. Parse the schedule from the user's request
2. Read existing `~/.zclawd/reminders.json` (or create if doesn't exist)
3. Add the new reminder with a unique ID
4. Save the file
5. Confirm to the user what was set

## Listing reminders

When user asks "what reminders do I have" or "list reminders":
1. Read `~/.zclawd/reminders.json`
2. Format and display each reminder with ID, schedule (human-readable), and prompt

## Deleting reminders

When user asks to remove/delete/cancel a reminder:
1. Read `~/.zclawd/reminders.json`
2. Remove the matching reminder by ID or description
3. Save the file
4. Confirm deletion
