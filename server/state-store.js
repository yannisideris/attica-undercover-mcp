import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const stateFile = process.env.ATTICA_STATE_FILE || join(__dirname, "..", "runtime", "attica-hidden-state.json");
const MAX_RUNS = 1000;

function emptyDb() {
  return { version: 1, runs: {} };
}

function loadDb() {
  try {
    if (!existsSync(stateFile)) return emptyDb();
    const parsed = JSON.parse(readFileSync(stateFile, "utf8"));
    if (!parsed || typeof parsed !== "object" || !parsed.runs) return emptyDb();
    return parsed;
  } catch {
    return emptyDb();
  }
}

function saveDb(db) {
  mkdirSync(dirname(stateFile), { recursive: true });
  const tmp = stateFile + ".tmp";
  writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  renameSync(tmp, stateFile);
}

function pruneRuns(db) {
  const entries = Object.entries(db.runs);
  if (entries.length <= MAX_RUNS) return;
  entries.sort((a, b) => String(a[1].createdAt).localeCompare(String(b[1].createdAt)));
  for (const [runId] of entries.slice(0, entries.length - MAX_RUNS)) delete db.runs[runId];
}

export function initializeMissionState({ runId, missionNumber, missionTitle, initialState }) {
  const db = loadDb();
  const existing = db.runs[runId];
  if (existing?.initialState) {
    return {
      status: "already_initialized",
      run: existing
    };
  }

  const now = new Date().toISOString();
  const run = {
    runId,
    createdAt: existing?.createdAt || now,
    initializedAt: now,
    missionNumber,
    missionTitle: missionTitle || null,
    initialState,
    events: existing?.events || []
  };
  db.runs[runId] = run;
  pruneRuns(db);
  saveDb(db);
  return { status: "initialized", run };
}

export function readMissionState(runId) {
  const db = loadDb();
  return db.runs[runId] || null;
}

export function recordMissionEvent({ runId, event }) {
  const db = loadDb();
  const run = db.runs[runId];
  if (!run?.initialState) return { status: "not_initialized", run: null };
  const entry = {
    seq: run.events.length ? run.events[run.events.length - 1].seq + 1 : 1,
    at: new Date().toISOString(),
    event
  };
  run.events.push(entry);
  db.runs[runId] = run;
  saveDb(db);
  return { status: "recorded", entry, run };
}

export function listRuns(limit = 10) {
  const runs = Object.values(loadDb().runs);
  runs.sort((a, b) => String(b.initializedAt || b.createdAt).localeCompare(String(a.initializedAt || a.createdAt)));
  return runs.slice(0, limit);
}

export function stateFilePath() {
  return stateFile;
}
