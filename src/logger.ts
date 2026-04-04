import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "./config.js";

function getLogDir(): string {
  return join(getDataDir(), "logs");
}

export function log(level: string, msg: string): void {
  const logDir = getLogDir();
  mkdirSync(logDir, { recursive: true });
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  const logFile = join(logDir, `${ts.split("T")[0]}.log`);
  appendFileSync(logFile, line + "\n");
}
