import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { getDataDir } from "./config.js";

export interface Reminder {
  id: string;
  schedule: string; // cron expression: "0 8 * * *"
  prompt: string;
  chatId: string;
  createdAt: string;
  lastRun: string | null;
}

function getRemindersPath(): string {
  return join(getDataDir(), "reminders.json");
}

export function loadReminders(): Reminder[] {
  const p = getRemindersPath();
  if (existsSync(p)) {
    try {
      return JSON.parse(readFileSync(p, "utf-8"));
    } catch {
      return [];
    }
  }
  return [];
}

export function saveReminders(reminders: Reminder[]): void {
  const p = getRemindersPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(reminders, null, 2));
}

export function addReminder(reminder: Omit<Reminder, "id" | "createdAt" | "lastRun">): Reminder {
  const reminders = loadReminders();
  const newReminder: Reminder = {
    ...reminder,
    id: Math.random().toString(36).substring(2, 10),
    createdAt: new Date().toISOString(),
    lastRun: null,
  };
  reminders.push(newReminder);
  saveReminders(reminders);
  return newReminder;
}

export function removeReminder(id: string): boolean {
  const reminders = loadReminders();
  const filtered = reminders.filter((r) => r.id !== id);
  if (filtered.length === reminders.length) return false;
  saveReminders(filtered);
  return true;
}

/**
 * Check if a cron expression matches the current time.
 * Supports: minute hour dayOfMonth month dayOfWeek
 * Supports: * (any), specific numbers, comma-separated
 * Example: "0 8 * * *" = every day at 8:00
 */
export function cronMatches(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay(); // 0=Sun

  return (
    fieldMatches(minExpr, minute) &&
    fieldMatches(hourExpr, hour) &&
    fieldMatches(domExpr, dayOfMonth) &&
    fieldMatches(monExpr, month) &&
    fieldMatches(dowExpr, dayOfWeek)
  );
}

function fieldMatches(expr: string, value: number): boolean {
  if (expr === "*") return true;

  // Handle */n (step)
  if (expr.startsWith("*/")) {
    const step = parseInt(expr.slice(2));
    return !isNaN(step) && step > 0 && value % step === 0;
  }

  // Handle comma-separated values
  const parts = expr.split(",");
  for (const part of parts) {
    // Handle range: 1-5
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (value >= start && value <= end) return true;
    } else {
      if (parseInt(part) === value) return true;
    }
  }

  return false;
}

/**
 * Get all reminders that are due right now.
 * A reminder is due if its cron matches current time AND
 * it hasn't been run in the current minute.
 */
export function getDueReminders(): Reminder[] {
  const reminders = loadReminders();
  const now = new Date();
  const currentMinute = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;

  const due: Reminder[] = [];
  for (const r of reminders) {
    if (!cronMatches(r.schedule, now)) continue;

    // Check if already run this minute
    if (r.lastRun) {
      const lastRunDate = new Date(r.lastRun);
      const lastMinute = `${lastRunDate.getFullYear()}-${lastRunDate.getMonth()}-${lastRunDate.getDate()}-${lastRunDate.getHours()}-${lastRunDate.getMinutes()}`;
      if (lastMinute === currentMinute) continue;
    }

    due.push(r);
  }

  return due;
}

export function markReminderRun(id: string): void {
  const reminders = loadReminders();
  const r = reminders.find((r) => r.id === id);
  if (r) {
    r.lastRun = new Date().toISOString();
    saveReminders(reminders);
  }
}
