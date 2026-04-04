import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(projectRoot, "dist", "cli.js");

describe("CLI", () => {
  it("should show help with no arguments", () => {
    const output = execSync(`node ${cli}`, { encoding: "utf-8" });
    assert.ok(output.includes("ZClawd"));
    assert.ok(output.includes("setup"));
    assert.ok(output.includes("start"));
    assert.ok(output.includes("doctor"));
    assert.ok(output.includes("telegram"));
    assert.ok(output.includes("pair"));
  });

  it("should show help with unknown command", () => {
    const output = execSync(`node ${cli} unknown-command`, { encoding: "utf-8" });
    assert.ok(output.includes("ZClawd"));
  });

  it("should show config", () => {
    const output = execSync(`node ${cli} config`, { encoding: "utf-8" });
    const config = JSON.parse(output);
    assert.ok(config.workspace);
    assert.ok(config.claudeBin);
    assert.ok(typeof config.heartbeatIntervalMs === "number");
  });

  it("should show status", () => {
    const output = execSync(`node ${cli} status`, { encoding: "utf-8" });
    assert.ok(output.includes("ZClawd Status"));
    assert.ok(output.includes("Session ID"));
    assert.ok(output.includes("Workspace"));
  });

  it("should show model without args", () => {
    const output = execSync(`node ${cli} model`, { encoding: "utf-8" });
    assert.ok(output.includes("Current model"));
    assert.ok(output.includes("claude-opus-4-6"));
  });

  it("should show telegram usage without token", () => {
    const output = execSync(`node ${cli} telegram`, { encoding: "utf-8" });
    assert.ok(output.includes("Usage"));
    assert.ok(output.includes("bot-token"));
  });

  it("should show pinecone usage without key", () => {
    const output = execSync(`node ${cli} pinecone`, { encoding: "utf-8" });
    assert.ok(output.includes("Usage"));
    assert.ok(output.includes("api-key"));
  });
});
