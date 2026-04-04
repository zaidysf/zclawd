import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Test cron matching logic directly
function fieldMatches(expr, value) {
  if (expr === "*") return true;
  if (expr.startsWith("*/")) {
    const step = parseInt(expr.slice(2));
    return !isNaN(step) && step > 0 && value % step === 0;
  }
  const parts = expr.split(",");
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (value >= start && value <= end) return true;
    } else {
      if (parseInt(part) === value) return true;
    }
  }
  return false;
}

function cronMatches(cron, date) {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;
  return (
    fieldMatches(minExpr, date.getMinutes()) &&
    fieldMatches(hourExpr, date.getHours()) &&
    fieldMatches(domExpr, date.getDate()) &&
    fieldMatches(monExpr, date.getMonth() + 1) &&
    fieldMatches(dowExpr, date.getDay())
  );
}

describe("Reminders", () => {
  describe("cron field matching", () => {
    it("should match wildcard", () => {
      assert.ok(fieldMatches("*", 0));
      assert.ok(fieldMatches("*", 59));
    });

    it("should match exact number", () => {
      assert.ok(fieldMatches("8", 8));
      assert.ok(!fieldMatches("8", 9));
    });

    it("should match comma-separated", () => {
      assert.ok(fieldMatches("8,20", 8));
      assert.ok(fieldMatches("8,20", 20));
      assert.ok(!fieldMatches("8,20", 10));
    });

    it("should match range", () => {
      assert.ok(fieldMatches("1-5", 1));
      assert.ok(fieldMatches("1-5", 3));
      assert.ok(fieldMatches("1-5", 5));
      assert.ok(!fieldMatches("1-5", 0));
      assert.ok(!fieldMatches("1-5", 6));
    });

    it("should match step", () => {
      assert.ok(fieldMatches("*/15", 0));
      assert.ok(fieldMatches("*/15", 15));
      assert.ok(fieldMatches("*/15", 30));
      assert.ok(!fieldMatches("*/15", 10));
    });
  });

  describe("cron expression matching", () => {
    it("should match every day at 8:00", () => {
      const at8am = new Date(2026, 3, 4, 8, 0); // April 4, 2026 8:00
      assert.ok(cronMatches("0 8 * * *", at8am));
    });

    it("should not match at wrong time", () => {
      const at9am = new Date(2026, 3, 4, 9, 0);
      assert.ok(!cronMatches("0 8 * * *", at9am));
    });

    it("should match weekdays only", () => {
      const monday = new Date(2026, 3, 6, 8, 0); // Monday
      const sunday = new Date(2026, 3, 5, 8, 0); // Sunday
      assert.ok(cronMatches("0 8 * * 1-5", monday));
      assert.ok(!cronMatches("0 8 * * 1-5", sunday));
    });

    it("should match every 30 minutes", () => {
      const at0 = new Date(2026, 3, 4, 10, 0);
      const at30 = new Date(2026, 3, 4, 10, 30);
      const at15 = new Date(2026, 3, 4, 10, 15);
      assert.ok(cronMatches("*/30 * * * *", at0));
      assert.ok(cronMatches("*/30 * * * *", at30));
      assert.ok(!cronMatches("*/30 * * * *", at15));
    });

    it("should reject invalid cron", () => {
      assert.ok(!cronMatches("invalid", new Date()));
      assert.ok(!cronMatches("0 8 *", new Date()));
    });
  });

  describe("reminder data structure", () => {
    it("should create valid reminder", () => {
      const reminder = {
        id: "abc123",
        schedule: "0 8 * * *",
        prompt: "Summarize emails and send to Telegram",
        chatId: "1049692111",
        createdAt: new Date().toISOString(),
        lastRun: null,
      };

      assert.equal(reminder.schedule, "0 8 * * *");
      assert.equal(reminder.lastRun, null);
      assert.ok(reminder.id.length > 0);
    });
  });
});
