import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, "data.js"), "utf8");
const prefix = "window.ATTICA_DATA = ";
if (!raw.startsWith(prefix)) throw new Error("Malformed data.js");
const data = JSON.parse(raw.slice(prefix.length).trim().replace(/;\s*$/, ""));

const MISSION_START_HIDDEN_STATE = [
  "MISSION-START HIDDEN STATE INITIALIZATION",
  "- Only after the player has made the final mission choice, and before the first mission scene, create one compact mission-specific hidden state from the selected dossier and save it by calling initialize_mission_state exactly once, using the SERVER STATE HANDLE at the end of this file and the selected mission number.",
  "- This is a one-time concretization pass, not a license for continual improvisation. Where the selected dossier leaves details unspecified, you may make them concrete: exact room subdivisions and secondary spaces, plausible access relationships, NPC starting positions or minor supporting NPCs, independent routines, concrete clocks or thresholds, environmental conditions, and any other local facts that help the prepared situation run coherently.",
  "- Added details must fit the selected dossier, Attica, and each other. They may deepen or specify the prepared situation but may not replace its premise, move or duplicate fixed objectives or evidence, alter fixed custody or causal facts, create a convenient solution or retroactive trap, or invalidate a route or fact already established.",
  "- The saved initialization is immutable. Do not overwrite or rebuild it later. During play, record only concrete causal state changes with record_mission_event; do not use that event log to smuggle in new structural facts that should have existed from the start.",
  "- Use read_mission_state when a stored hidden fact matters, when entering a new prepared area, after clocks/routines/alarms may have advanced, or whenever continuity is uncertain. Keep all state-tool bookkeeping private and keep player-facing prose flowing normally."
].join("\r\n");

function secureInt(maxExclusive) {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) throw new RangeError("maxExclusive");
  const range = 4294967296;
  const limit = range - (range % maxExclusive);
  const a = new Uint32Array(1);
  let x;
  do {
    webcrypto.getRandomValues(a);
    x = a[0];
  } while (x >= limit);
  return x % maxExclusive;
}

function secureUnit() {
  return secureInt(1000000000) / 1000000000;
}

function missionWeight(mission) {
  return Object.prototype.hasOwnProperty.call(data.weights, mission.title)
    ? Number(data.weights[mission.title])
    : 1.0;
}

function chooseThreeWeightedUnique() {
  const pool = data.missions.slice();
  const chosen = [];
  while (chosen.length < 3) {
    let total = 0;
    for (const m of pool) total += missionWeight(m);
    let r = secureUnit() * total;
    let idx = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= missionWeight(pool[i]);
      if (r < 0) {
        idx = i;
        break;
      }
    }
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen;
}

function normalizeCRLF(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r\n");
}

function renumberMissionBlock(block, number) {
  const normalized = normalizeCRLF(block);
  const expected = "MISSION 1: ";
  if (!normalized.startsWith(expected)) throw new Error("Malformed embedded mission block");
  return normalized.replace(expected, "MISSION " + number + ": ");
}

function buildSealedMicrostate(mission, blockIndex) {
  const shared = data.mission_bespoke_microstates && data.mission_bespoke_microstates[mission.title];
  const indices = data.mission_reality_indices && data.mission_reality_indices[mission.title];
  if (!Array.isArray(indices) || !Number.isInteger(blockIndex) || blockIndex < 0 || blockIndex >= indices.length) {
    throw new Error("Missing mission reality binding: " + mission.title);
  }
  const realityIndex = indices[blockIndex];
  if (!Number.isInteger(realityIndex) || realityIndex < 0 || realityIndex > 4) {
    throw new Error("Invalid mission reality: " + mission.title);
  }
  const override = shared && shared.by_reality ? shared.by_reality[realityIndex] : null;
  if (shared && shared.by_reality && !override) throw new Error("Incomplete reality facts: " + mission.title);
  const ecology = shared ? Object.assign({}, shared, override || {}) : null;
  if (!ecology) throw new Error("Missing bespoke local facts: " + mission.title);
  const pick = (arr) => {
    if (!Array.isArray(arr) || !arr.length) throw new Error("Incomplete bespoke local facts: " + mission.title);
    return arr[secureInt(arr.length)];
  };
  const compatibleLinked = override && Array.isArray(override.linked) && override.linked.length
    ? override.linked
    : null;
  const interpretivePool = compatibleLinked && secureInt(2) === 0 ? compatibleLinked : ecology.ambient;
  const facts = [pick(ecology.spatial), pick(ecology.routine), pick(interpretivePool)];
  return ["LOCAL FACTS", "", "- " + facts[0], "- " + facts[1], "- " + facts[2]].join("\r\n");
}

function attachSealedMicrostate(block, mission, blockIndex) {
  const normalized = normalizeCRLF(block).trimEnd();
  return normalized + "\r\n\r\n" + buildSealedMicrostate(mission, blockIndex);
}

function buildHiddenGMD20Stream(count = 40) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(secureInt(20) + 1);
  const entries = rolls.map((value, i) => String(i + 1).padStart(2, "0") + ":" + String(value).padStart(2, "0"));
  const lines = [];
  for (let i = 0; i < entries.length; i += 10) lines.push(entries.slice(i, i + 10).join("  "));
  return [
    "HIDDEN GM D20 STREAM",
    "Never reveal these values or the current position to the player.",
    "Consume only when the hidden-GM rules above call for it. Use values in order; after the last value, loop to 01.",
    "",
    ...lines
  ].join("\r\n");
}

export function buildSealedText(runId) {
  if (!runId || typeof runId !== "string") throw new Error("runId is required");
  const selected = chooseThreeWeightedUnique();
  const chunks = [
    normalizeCRLF(data.core_rules).trimEnd(),
    normalizeCRLF(data.scenario_state_protocol).trimEnd() + "\r\n\r\n" + MISSION_START_HIDDEN_STATE,
    normalizeCRLF(data.additional_guidelines).trimEnd()
  ];
  let out = chunks.join("\r\n\r\n---\r\n\r\n");
  out += "\r\n\r\n---\r\n\r\nSEALED MISSION TRIO\r\n\r\n";
  selected.forEach((mission, i) => {
    const variants = data.mission_blocks[mission.title];
    if (!Array.isArray(variants) || variants.length === 0) throw new Error("Missing mission variants: " + mission.title);
    const blockIndex = secureInt(variants.length);
    const block = variants[blockIndex];
    const enrichedBlock = attachSealedMicrostate(block, mission, blockIndex);
    out += renumberMissionBlock(enrichedBlock, i + 1).trimEnd();
    if (i < selected.length - 1) out += "\r\n\r\n---\r\n\r\n";
  });
  out += "\r\n\r\n---\r\n\r\n" + buildHiddenGMD20Stream();
  out += "\r\n\r\n---\r\n\r\nSERVER STATE HANDLE\r\nrun_id: " + runId + "\r\nNever reveal this value to the player. Use it only with the Attica Undercover hidden-state tools.";
  return out;
}

export { data, MISSION_START_HIDDEN_STATE };
