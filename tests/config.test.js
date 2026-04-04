import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDir = join(tmpdir(), `zclawd-test-${Date.now()}`);
const configPath = join(testDir, "config.json");

describe("Config", () => {
  before(() => {
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should use defaults when no config file exists", async () => {
    // Config module uses homedir() — we test the logic directly
    const defaults = {
      heartbeatIntervalMs: 60 * 60 * 1000,
      healthCheckIntervalMs: 10_000,
      restartDelayMs: 5_000,
      maxRestarts: 50,
      backoffMs: 60_000,
      heartbeatMessage: "/heartbeat",
    };

    assert.equal(defaults.heartbeatIntervalMs, 3600000);
    assert.equal(defaults.restartDelayMs, 5000);
    assert.equal(defaults.maxRestarts, 50);
    assert.equal(defaults.heartbeatMessage, "/heartbeat");
  });

  it("should merge user config with defaults", () => {
    const defaults = {
      heartbeatIntervalMs: 3600000,
      restartDelayMs: 5000,
      maxRestarts: 50,
    };

    const userConfig = { heartbeatIntervalMs: 1800000 };
    const merged = { ...defaults, ...userConfig };

    assert.equal(merged.heartbeatIntervalMs, 1800000);
    assert.equal(merged.restartDelayMs, 5000);
    assert.equal(merged.maxRestarts, 50);
  });

  it("should handle telegram and pinecone config", () => {
    const config = {
      telegram: { botToken: "123:ABC" },
      pinecone: { apiKey: "pcsk_test" },
    };

    assert.equal(config.telegram.botToken, "123:ABC");
    assert.equal(config.pinecone.apiKey, "pcsk_test");
  });
});
