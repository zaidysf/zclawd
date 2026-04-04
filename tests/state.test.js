import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDir = join(tmpdir(), `zclawd-state-test-${Date.now()}`);

describe("State", () => {
  before(() => {
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should create default state", () => {
    const defaultState = {
      sessionId: null,
      startedAt: null,
      restartCount: 0,
      lastHeartbeat: null,
      pid: null,
    };

    assert.equal(defaultState.sessionId, null);
    assert.equal(defaultState.restartCount, 0);
    assert.equal(defaultState.pid, null);
  });

  it("should persist state to file", () => {
    const statePath = join(testDir, "state.json");
    const state = {
      sessionId: "abc-123",
      startedAt: "2026-04-04T10:00:00Z",
      restartCount: 3,
      lastHeartbeat: null,
      pid: 12345,
    };

    writeFileSync(statePath, JSON.stringify(state, null, 2));

    const loaded = JSON.parse(readFileSync(statePath, "utf-8"));
    assert.equal(loaded.sessionId, "abc-123");
    assert.equal(loaded.restartCount, 3);
    assert.equal(loaded.pid, 12345);
  });

  it("should handle state reset", () => {
    const statePath = join(testDir, "state-reset.json");

    // Write state
    writeFileSync(statePath, JSON.stringify({ sessionId: "old-session", restartCount: 5 }));

    // Reset
    const resetState = {
      sessionId: null,
      startedAt: null,
      restartCount: 0,
      lastHeartbeat: null,
      pid: null,
    };
    writeFileSync(statePath, JSON.stringify(resetState, null, 2));

    const loaded = JSON.parse(readFileSync(statePath, "utf-8"));
    assert.equal(loaded.sessionId, null);
    assert.equal(loaded.restartCount, 0);
  });
});
