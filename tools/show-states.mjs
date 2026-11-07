// Playtest viewer: downloads the latest hidden mission states from the server
// and writes them as a readable Markdown file in state-review/ (git-ignored).
// Usage: node tools/show-states.mjs [limit] [baseUrl]
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const limit = Number(process.argv[2]) || 5;
const base = process.argv[3] || "https://attica-undercover-mcp.onrender.com";
const token = readFileSync(join(root, ".admin-token"), "utf8").trim();

// No process.exit() after fetch: on Windows it trips a libuv assertion.
const res = await fetch(`${base}/admin/runs?limit=${limit}`, { headers: { "x-admin-token": token } });
const runs = res.ok ? await res.json() : null;
if (!res.ok) {
  console.error(`Request failed: ${res.status}`);
  process.exitCode = 1;
} else if (!runs.length) {
  console.log("No saved states yet (the server keeps them only until its next restart).");
} else {
  writeReport(runs);
}

function writeReport(runs) {
const out = [`# Attica Undercover — hidden states (${new Date().toLocaleString("el-GR")})`, ""];
for (const r of runs) {
  out.push(`## Mission ${r.missionNumber}${r.missionTitle ? " — " + r.missionTitle : ""}`);
  out.push(`run_id \`${r.runId}\` · initialized ${r.initializedAt} · ${r.events.length} events`, "");
  out.push("### Mission-start state", "", "```", r.initialState, "```", "");
  out.push("### Events", "");
  if (!r.events.length) out.push("_(none)_");
  for (const e of r.events) out.push(`${e.seq}. \`${e.at.slice(11, 19)}\` ${e.event}`);
  out.push("", "---", "");
}
const dir = join(root, "state-review");
mkdirSync(dir, { recursive: true });
const file = join(dir, `states-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`);
writeFileSync(file, out.join("\n"), "utf8");
console.log(`${runs.length} run(s) written to ${file}`);
}
