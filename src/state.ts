import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { getDataDir } from "./config.js";

export interface State {
  sessionId: string | null;
  startedAt: string | null;
  restartCount: number;
  lastHeartbeat: string | null;
  pid: number | null;
}

function getStatePath(): string {
  return join(getDataDir(), "state.json");
}

const DEFAULT_STATE: State = {
  sessionId: null,
  startedAt: null,
  restartCount: 0,
  lastHeartbeat: null,
  pid: null,
};

export function loadState(): State {
  const p = getStatePath();
  if (existsSync(p)) {
    try {
      return { ...DEFAULT_STATE, ...JSON.parse(readFileSync(p, "utf-8")) };
    } catch {
      return { ...DEFAULT_STATE };
    }
  }
  return { ...DEFAULT_STATE };
}

export function saveState(state: State): void {
  const p = getStatePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(state, null, 2));
}
