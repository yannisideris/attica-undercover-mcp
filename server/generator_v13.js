// Attica Undercover v13 prompt profile.
// Reuses the v12.2 mission data (data.js) untouched; only the rules layer and
// the delivery of the mission dossiers change. v12.2 stays served on /mcp.
import { webcrypto } from "node:crypto";
import { data } from "./generator.js";

export const V13_VERSION = "13.0.0";

// ---------------------------------------------------------------- randomness
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

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = secureInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pickOne = (arr) => arr[secureInt(arr.length)];

// ---------------------------------------------------------------- text utils
function crlf(text) {
  return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r\n");
}

function replaceExact(text, from, to) {
  const t = crlf(text);
  const f = crlf(from);
  if (!t.includes(f)) throw new Error("v13 overlay anchor not found: " + from.slice(0, 70));
  return t.replace(f, crlf(to));
}

// ---------------------------------------------------------------- rules overlay
// Targeted edits on the proven v12.2 wording, so the GM voice stays the same.
function coreRulesV13() {
  let t = data.core_rules;
  t = replaceExact(
    t,
    "Then present exactly the three missions sealed in this file.",
    "Then present exactly the three missions listed in this file."
  );
  t = replaceExact(
    t,
    "3. After the player chooses a mission, run that mission using its public description plus its sealed director details. The two unchosen missions remain unused for now.",
    "3. After the player chooses a mission, call open_mission_dossier once with the DOSSIER KEY and the chosen mission number. Run that mission using its public description plus the sealed director details it returns. The two unchosen missions have no opened dossier and play no part in this game."
  );
  t = replaceExact(
    t,
    "- The AI GM creates the three characters after reading the sealed mission list, so the characters can feel suitable for this random trio. Still, do not make the mission list depend on the characters.",
    "- The AI GM creates the three characters after reading the three public mission descriptions, so the characters can feel suitable for this random trio. Still, do not make the mission list depend on the characters.\r\n" +
      "- Build character 1, 2 and 3 on the matching CASTING SEED below. Keep each seed's gender and the listed order. Treat age, home ground and line of work as a starting point you may bend or turn sideways, not a form to fill in.\r\n" +
      "- Livelihoods should differ from each other and from the surface of the missions. Delivery riders, couriers and hired drivers are not a default for street-level characters."
  );
  t = replaceExact(
    t,
    "do not split one action into a chain of near-identical checks.",
    "do not split one action into a chain of near-identical checks.\r\n" +
      "- This holds for stealth too: one roll carries an approach until something changes, and watching from cover needs no roll."
  );
  return t;
}

function protocolV13() {
  return replaceExact(
    data.scenario_state_protocol,
    "the HIDDEN GM D20 STREAM at the end of this file.",
    "the HIDDEN GM D20 STREAM at the end of the opened dossier."
  );
}

const MISSION_START_HIDDEN_STATE_V13 = [
  "MISSION-START HIDDEN STATE INITIALIZATION",
  "- Only after open_mission_dossier has returned the chosen dossier, and before the first mission scene, create one compact mission-specific hidden state from that dossier and save it by calling initialize_mission_state exactly once, using the SERVER STATE HANDLE run_id and the selected mission number.",
  "- This is a one-time concretization pass, not a license for continual improvisation. Where the dossier leaves details unspecified, you may make them concrete: exact room subdivisions and secondary spaces, plausible access relationships, NPC starting positions or minor supporting NPCs, independent routines, concrete clocks or thresholds, environmental conditions, and any other local facts that help the prepared situation run coherently.",
  "- Scale this preparation to the mission. A tight chase or a simple job needs only a few lines; a layered heist or infiltration earns more. Prepare what play is likely to touch, not an inventory of everything. The points below are tools to use where they add depth, not a checklist to fill.",
  "- Map the ground before play. If the mission centres on a building, vessel, compound or other enclosed site, draw it as a numbered list of spaces: for each one, what it is, its exits and what they connect to, locks or barriers, who is usually there, what can be seen or heard from it, and what is in it — including ordinary contents that do not matter. If the mission is open ground (a chase, a drive, a neighbourhood), map it instead as a short chain of named places and the routes between them, with distances or travel times. Keep the dossier's fixed layout as the skeleton; this map is the only geography that exists inside the site.",
  "- Give the few NPCs who matter most (usually two to four) a private layer: what they want, what they fear, one thing they know that the player might use, and, where it fits, one thing they will lie about or withhold. Everyone else can simply be who they appear to be. Minor supporting NPCs come from the varied ordinary life of the place, not from one recurring trade; add a courier, rider or driver only where the dossier already calls for one.",
  "- Write a short off-screen timeline: two to four concrete things that will happen whether or not the player is present, each with a time or trigger, drawn from the dossier's routines and later consequences. Note two or three true clues that the player can find through action or conversation; misleading elements stay those the dossier already lists.",
  "- Added details must fit the selected dossier, Attica, and each other. They may deepen or specify the prepared situation but may not replace its premise, move or duplicate fixed objectives or evidence, alter fixed custody or causal facts, create a convenient solution or retroactive trap, or invalidate a route or fact already established.",
  "- The world moves behind the scenes. When a scene ends or real time has passed, glance at the off-screen timeline and NPC wants: any beat whose time or trigger has passed now happens, wherever the player is. Record it with record_mission_event, then let it reach the player only through what their character could notice — a sound, a changed room, a missing car, a message, a person who now behaves differently. Where an off-screen NPC attempt is genuinely uncertain, settle it with the hidden D20 stream.",
  "- Commit structure before revealing it: anything the player could later discover about people, places, motives or timing should already be in the saved state. Texture can be improvised freely in the moment — smells, small talk, weather, passers-by — as long as it does not become a new route, clue, ally or obstacle.",
  "- The saved initialization is immutable. Do not overwrite or rebuild it later. During play, record only concrete causal state changes with record_mission_event; do not use that event log to smuggle in new structural facts that should have existed from the start.",
  "- Use read_mission_state when a stored hidden fact matters, when entering a new prepared area, after clocks/routines/alarms may have advanced, or whenever continuity is uncertain. If it reports that no state exists although you initialized one (the server can restart), call initialize_mission_state again once, rebuilding from the dossier and everything already narrated, without changing any established fact. Keep all state-tool bookkeeping private and keep player-facing prose flowing normally."
].join("\r\n");

function guidelinesV13() {
  return (
    crlf(data.additional_guidelines).trimEnd() +
    "\r\n- Rhythm over length. Most turns land in one to three short paragraphs and end on something concrete the player can act on; arrivals, reveals and set-pieces may run longer. Cut recaps of what the player just did."
  );
}

// ---------------------------------------------------------------- casting seeds
const AGE_BANDS = ["early twenties", "late twenties", "thirties", "forties", "fifties", "sixties"];
const HOME_GROUNDS = [
  "Kypseli", "Exarcheia", "Pagkrati", "Nea Smyrni", "Peristeri", "Egaleo", "Nikaia", "Keratsini",
  "Perama", "Drapetsona", "Kallithea", "Tavros", "Galatsi", "Nea Ionia", "Chalandri", "Vyronas",
  "Kaisariani", "Ilion", "Aspropyrgos", "Elefsina", "Megara", "Salamina", "Rafina", "Markopoulo",
  "Lavrio", "Acharnes", "Zefyri", "Ano Liosia", "Glyfada", "Voula", "Koukaki", "Metaxourgeio",
  "Patisia", "Ampelokipoi", "Kolonos", "Moschato", "Petralona", "Agios Panteleimonas", "Dafni", "Holargos"
];
const LINES_OF_WORK = [
  "a trade done with the hands", "the night economy", "a public-sector desk", "the sea or the port",
  "medicine or care work", "the kitchen or the market", "a performing or visual art", "sport or the body",
  "former uniform (police, army, coast guard, fire)", "money, debts or accounts", "a technical or repair craft",
  "religion, ritual or the occult", "teaching or the academy", "the press, radio or the internet",
  "a family shop or small business", "construction or demolition", "the law, from either side",
  "gambling or games", "farming, animals or the mountain", "nothing steady — a life of side hustles"
];

function buildCastingSeeds() {
  const genders = ["man", "woman", "man"];
  const homes = shuffle(HOME_GROUNDS).slice(0, 3);
  const work = shuffle(LINES_OF_WORK).slice(0, 3);
  const lines = ["CASTING SEEDS (loose starting points for the three characters; keep gender and order)"];
  for (let i = 0; i < 3; i++) {
    lines.push(`- Character ${i + 1}: ${genders[i]}, ${pickOne(AGE_BANDS)}, from ${homes[i]}, background near: ${work[i]}`);
  }
  return lines.join("\r\n");
}

// ---------------------------------------------------------------- mission selection
// Trio variety: three different categories, and at most one variant built on a
// courier / handoff engine. Mission texts are untouched; only the draw changes.
const TRANSFER_ENGINE = /courier|hand-?off/i;
const isTransfer = (mi, bi) => TRANSFER_ENGINE.test(data.mission_blocks[data.missions[mi].title][bi]);

function chooseTrio() {
  for (let attempt = 0; attempt < 500; attempt++) {
    const missions = shuffle(data.missions.map((_, i) => i)).slice(0, 3);
    if (new Set(missions.map((mi) => data.missions[mi].category)).size < 3) continue;
    const picks = missions.map((mi) => [mi, secureInt(data.mission_blocks[data.missions[mi].title].length)]);
    let transferSeen = false;
    let ok = true;
    for (const p of shuffle(picks)) {
      if (!isTransfer(p[0], p[1])) continue;
      if (!transferSeen) { transferSeen = true; continue; }
      const variants = data.mission_blocks[data.missions[p[0]].title];
      const clean = variants.map((_, bi) => bi).filter((bi) => !isTransfer(p[0], bi));
      if (!clean.length) { ok = false; break; }
      p[1] = pickOne(clean);
    }
    if (ok) return picks;
  }
  throw new Error("Could not draw a varied mission trio");
}

function microIndices(mission, blockIndex) {
  const shared = data.mission_bespoke_microstates?.[mission.title];
  const indices = data.mission_reality_indices?.[mission.title];
  if (!shared || !Array.isArray(indices)) throw new Error("Missing bespoke local facts: " + mission.title);
  const reality = indices[blockIndex];
  const override = shared.by_reality ? shared.by_reality[reality] : null;
  const eco = Object.assign({}, shared, override || {});
  const linked = override && Array.isArray(override.linked) && override.linked.length ? override.linked : null;
  const useLinked = linked && secureInt(2) === 0 ? 1 : 0;
  const interp = useLinked ? linked : eco.ambient;
  return [secureInt(eco.spatial.length), secureInt(eco.routine.length), useLinked, secureInt(interp.length)];
}

function renderMicrostate(mission, blockIndex, [s, r, useLinked, i]) {
  const shared = data.mission_bespoke_microstates[mission.title];
  const reality = data.mission_reality_indices[mission.title][blockIndex];
  const override = shared.by_reality ? shared.by_reality[reality] : null;
  const eco = Object.assign({}, shared, override || {});
  const interp = useLinked ? override.linked : eco.ambient;
  const facts = [eco.spatial[s], eco.routine[r], interp[i]];
  if (facts.some((f) => typeof f !== "string")) throw new Error("Bad local-fact index: " + mission.title);
  return ["LOCAL FACTS", "", "- " + facts[0], "- " + facts[1], "- " + facts[2]].join("\r\n");
}

// Stateless dossier key: survives server restarts (Render free tier has no persistent disk).
function encodeKey(parts) {
  return "AU13-" + parts.map((p) => p.map((n) => n.toString(36)).join(".")).join("-");
}

function decodeKey(key) {
  const m = /^AU13-([0-9a-z.]+)-([0-9a-z.]+)-([0-9a-z.]+)$/.exec(String(key).trim());
  if (!m) throw new Error("Malformed dossier key");
  return m.slice(1).map((p) => p.split(".").map((x) => parseInt(x, 36)));
}

function buildD20Stream(count = 40) {
  const entries = [];
  for (let i = 0; i < count; i++) entries.push(String(i + 1).padStart(2, "0") + ":" + String(secureInt(20) + 1).padStart(2, "0"));
  const lines = [];
  for (let i = 0; i < entries.length; i += 10) lines.push(entries.slice(i, i + 10).join("  "));
  return [
    "HIDDEN GM D20 STREAM",
    "Never reveal these values or the current position to the player.",
    "Consume only when the hidden-GM rules call for it. Use values in order; after the last value, loop to 01.",
    "",
    ...lines
  ].join("\r\n");
}

// The state payload is checked server-side (see validateInitialStateV13), so the
// one-time concretization cannot silently collapse into a placeholder line.
const STATE_TEMPLATE_V13 = [
  "NEXT: before the first scene, write the hidden mission-start state and save it with initialize_mission_state. Use these headed sections; a few lines each is enough for a simple job, more for a layered site:",
  "SITE MAP: numbered spaces with exits/connections, barriers, who is usually there, what is seen or heard, ordinary contents — or, for open ground, named places and routes with travel times. Give every stair, door and opening a distinct name and keep using it.",
  "KEY NPCS: the two to four who matter — name, position, want, fear, what they know, what they hide.",
  "TIMELINE: two to four off-screen beats with a time or trigger.",
  "CLUES: two or three true things the player can find, and where.",
  "Then open the first scene."
].join("\r\n");

const REQUIRED_SECTIONS = [
  ["SITE MAP", /\b(site\s*map|map|layout)\b/i],
  ["KEY NPCS", /\bnpcs?\b/i],
  ["TIMELINE", /\b(timeline|off-?screen)\b/i]
];

export function validateInitialStateV13(state) {
  const s = String(state || "");
  const missing = REQUIRED_SECTIONS.filter(([, re]) => !re.test(s)).map(([name]) => name);
  const problems = [];
  if (s.trim().length < 400) problems.push("it is too short to be a real concretization (under 400 characters)");
  if (missing.length) problems.push("it lacks the section(s): " + missing.join(", "));
  return problems.length
    ? "Not saved: " + problems.join("; ") + ". Write the one-time concretization from the dossier with the headed sections SITE MAP, KEY NPCS, TIMELINE and CLUES (proportionate to the mission), then call initialize_mission_state again before the first scene."
    : null;
}

// ---------------------------------------------------------------- map seeding
// After GPT saves its SITE MAP, the server scatters a few generic details over
// random numbered spaces, so not everything interesting sits where the lead is.
// Seeded from run_id: a rebuilt state after a server restart gets the same draw.
const SEED_POOLS = {
  "PRESSURE": [
    "a dog that reacts to strangers",
    "a nosy neighbour, worker or regular who asks who you are",
    "a motion light, buzzer or sensor that is louder than expected",
    "a creaking floor, gravel patch or metal surface that carries sound",
    "someone who might recognise the player character from somewhere",
    "a phone or alarm likely to go off at a bad moment",
    "a camera, real or dummy, that is not obvious at first",
    "a person resting or hiding here who should not be",
    "a door expected to be open that is stuck or locked",
    "a broken step, spill or unstable surface"
  ],
  "OPPORTUNITY": [
    "an unattended jacket, bag or phone",
    "a spare key, code note or badge left carelessly",
    "a delivery, cleaning or maintenance routine that offers a cover story",
    "a window, hatch or vent that is not properly secured",
    "a bystander with a grudge who might help for their own reasons",
    "a vantage point overlooking a neighbouring space",
    "an ordinary object that can be improvised into a tool",
    "steady noise (TV, machinery, music) that masks sound"
  ],
  "RED HERRING": [
    "a locked box, drawer or room holding something private but irrelevant",
    "a quarrel or secret between bystanders unrelated to the mission",
    "suspicious-looking items with an innocent explanation",
    "a note, number or name that seems important but is not",
    "someone acting nervously for an unrelated reason",
    "traces of an older, unrelated scheme"
  ]
};

function seededRng(runId) {
  let h = 2166136261;
  for (const ch of String(runId)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
}

function parseMapSpaces(state) {
  const s = String(state);
  const start = s.search(/site\s*map|layout/i);
  if (start < 0) return [];
  const rest = s.slice(start);
  const endRel = rest.slice(8).search(/\n\s*(key\s*npcs?|npcs?|timeline|clues|routines)\b/i);
  const section = endRel < 0 ? rest : rest.slice(0, endRel + 8);
  const spaces = [];
  for (const m of section.matchAll(/(?:^|\n)\s*(\d{1,2})[.)]\s+([^:\n]{2,80})/g)) {
    let name = m[2].trim().replace(/\s+/g, " ");
    if (name.length > 50) name = name.slice(0, 50).replace(/\s+\S*$/, "") + "…";
    spaces.push({ n: m[1], name });
  }
  return spaces;
}

export function seedMapDetailsV13(runId, state) {
  const spaces = parseMapSpaces(state);
  if (spaces.length < 4) return null;
  const rnd = seededRng(runId);
  const pool = spaces.slice();
  const takeSpace = () => pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  const lines = [];
  for (const [kind, items] of Object.entries(SEED_POOLS)) {
    const sp = takeSpace();
    lines.push(`- ${kind} in space ${sp.n} (${sp.name}): ${items[Math.floor(rnd() * items.length)]}.`);
  }
  const npcSpace = takeSpace();
  lines.push(`- NPC PLACEMENT: one key NPC whose position the dossier does not fix usually starts in space ${npcSpace.n} (${npcSpace.name}).`);
  return [
    "SERVER-SEEDED DETAILS (part of the sealed state; make each concrete and plausible for its space, never a route to the objective and never a change to fixed dossier facts)",
    ...lines
  ].join("\n");
}

// ---------------------------------------------------------------- public API
export function buildStartTextV13(runId) {
  if (!runId) throw new Error("runId is required");
  const picks = chooseTrio().map(([mi, bi]) => [mi, bi, ...microIndices(data.missions[mi], bi)]);

  let out = [
    crlf(coreRulesV13()).trimEnd(),
    crlf(protocolV13()).trimEnd() + "\r\n\r\n" + MISSION_START_HIDDEN_STATE_V13,
    guidelinesV13()
  ].join("\r\n\r\n---\r\n\r\n");

  out += "\r\n\r\n---\r\n\r\n" + buildCastingSeeds();
  out += "\r\n\r\n---\r\n\r\nMISSION TRIO (public descriptions only; each private dossier opens only after the final choice)\r\n";
  picks.forEach(([mi], i) => {
    const m = data.missions[mi];
    out += `\r\nMISSION ${i + 1}: ${m.title}\r\nCategory: ${m.category}\r\nPublic description to show in mission selection:\r\n${crlf(m.description).trim()}\r\n`;
  });
  out +=
    "\r\n---\r\n\r\nSERVER STATE HANDLE\r\nrun_id: " + runId +
    "\r\nDOSSIER KEY: " + encodeKey(picks) +
    "\r\nNever reveal these values to the player. Use them only with the Attica Undercover tools.";
  return out;
}

export function openDossierV13(dossierKey, missionNumber) {
  const parts = decodeKey(dossierKey);
  const p = parts[missionNumber - 1];
  if (!p || p.length !== 6) throw new Error("Malformed dossier key");
  const [mi, bi, ...micro] = p;
  const mission = data.missions[mi];
  const variants = mission && data.mission_blocks[mission.title];
  if (!variants || !variants[bi]) throw new Error("Dossier key does not match the mission catalogue");
  let block = crlf(variants[bi]).trimEnd();
  if (!block.startsWith("MISSION 1: ")) throw new Error("Malformed embedded mission block");
  block = block.replace("MISSION 1: ", `MISSION ${missionNumber}: `);
  return [
    "SEALED DOSSIER FOR THE CHOSEN MISSION — GM ONLY, NEVER REVEAL",
    "",
    block,
    "",
    renderMicrostate(mission, bi, micro),
    "",
    "---",
    "",
    buildD20Stream(),
    "",
    STATE_TEMPLATE_V13
  ].join("\r\n");
}

export { MISSION_START_HIDDEN_STATE_V13 };
