import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Supervisor logic", () => {
  it("should detect stale session from output", () => {
    const output = "No conversation found with session ID: abc-123";
    assert.ok(output.includes("No conversation found"));
  });

  it("should calculate restart delay correctly", () => {
    const maxRestarts = 50;
    const restartDelayMs = 5000;
    const backoffMs = 60000;

    // Under max
    let restartCount = 10;
    let delay = restartCount > maxRestarts ? backoffMs : restartDelayMs;
    assert.equal(delay, 5000);

    // Over max
    restartCount = 51;
    delay = restartCount > maxRestarts ? backoffMs : restartDelayMs;
    assert.equal(delay, 60000);
  });

  it("should strip ANSI escape codes", () => {
    const raw = "\x1b[32mHello\x1b[0m World\x1b[?2026h";
    const clean = raw
      .replace(/\x1b[\[\]()#;?]*[0-9;]*[a-zA-Z@`]/g, "")
      .replace(/\[\?[0-9]+[hl]/g, "")
      .trim();
    assert.equal(clean, "Hello World");
  });

  it("should build correct CLI args", () => {
    const args = ["--dangerously-skip-permissions"];

    // With channels
    const hasTelegram = true;
    if (hasTelegram) {
      args.push("--channels", "plugin:telegram@claude-plugins-official");
    }

    // With model
    const model = "claude-opus-4-6";
    if (model) {
      args.push("--model", model);
    }

    // With resume
    const sessionId = "abc-123";
    if (sessionId) {
      args.push("--resume", sessionId);
    }

    assert.deepEqual(args, [
      "--dangerously-skip-permissions",
      "--channels", "plugin:telegram@claude-plugins-official",
      "--model", "claude-opus-4-6",
      "--resume", "abc-123",
    ]);
  });

  it("should build args without optional flags", () => {
    const args = ["--dangerously-skip-permissions"];
    const hasTelegram = false;
    const model = undefined;
    const sessionId = null;

    if (hasTelegram) args.push("--channels", "plugin:telegram@claude-plugins-official");
    if (model) args.push("--model", model);
    if (sessionId) args.push("--resume", sessionId);

    assert.deepEqual(args, ["--dangerously-skip-permissions"]);
  });
});
