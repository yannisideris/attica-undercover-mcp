import { randomUUID } from "node:crypto";
import { buildStartTextV13, openDossierV13, validateInitialStateV13, MISSION_START_HIDDEN_STATE_V13 } from "./generator_v13.js";

const failures = [];
const lens = [];
for (let n = 0; n < 300; n++) {
  const runId = randomUUID();
  const t = buildStartTextV13(runId);
  lens.push(t.length);
  if (!t.startsWith("SEALED SYSTEM PROMPT FOR ATTICA UNDERCOVER")) failures.push("start");
  if (!t.includes(MISSION_START_HIDDEN_STATE_V13)) failures.push("hidden state block");
  if ((t.match(/\r\nMISSION [123]: /g) || []).length !== 3) failures.push("trio count");
  if (/PRIVATE GM DOSSIER|HIDDEN GM D20 STREAM\r\n/.test(t)) failures.push("private dossier leaked into start text");
  const seeds = t.match(/- Character \d: (woman|man)/g) || [];
  if (seeds.length !== 3 || !seeds.some((s) => s.endsWith("woman")) || !seeds.some((s) => s.endsWith(" man"))) failures.push("casting seeds");
  const key = /DOSSIER KEY: (\S+)/.exec(t)[1];
  for (const k of [1, 2, 3]) {
    const d = openDossierV13(key, k);
    if (!d.includes(`MISSION ${k}: `) || !d.includes("PRIVATE GM DOSSIER") || !d.includes("LOCAL FACTS") || !d.includes("HIDDEN GM D20 STREAM") || !d.includes("SITE MAP:")) failures.push("dossier " + k);
    const title = new RegExp(`MISSION ${k}: ([^\\r\\n]+)`).exec(t)[1].trim();
    if (!d.includes(`MISSION ${k}: ${title}`)) failures.push("dossier/title mismatch " + title);
  }
}
if (!validateInitialStateV13("Anthousa siege hidden state initialized from dossier.")) failures.push("placeholder state accepted");
const good = "SITE MAP:\n1 Garage (ramp from road) -> internal concrete stair -> 2 landing (fuse box) -> 3 living room (front balcony door) / 4 kitchen (back balcony door, back stairs to garden). Side metal stair to front balcony.\nKEY NPCS:\nStelios Kouris, resident: wants the target gone by morning, fears the attackers know him, knows the garden gate is unlocked, hides that he called someone.\nTIMELINE:\n+3 min Team A enters garage; +5 min Team B climbs back stairs; +12 min police arrive if called.\nCLUES:\nFresh tyre marks at the ramp; the gate chain is cut.";
if (validateInitialStateV13(good)) failures.push("good state rejected: " + validateInitialStateV13(good));
let bad = false;
try { openDossierV13("AU13-zz", 1); } catch { bad = true; }
if (!bad) failures.push("malformed key accepted");

if (failures.length) { console.error([...new Set(failures)].join("\n")); process.exit(1); }
console.log("v13 OK — 300 games, start text chars min/avg/max:", Math.min(...lens), Math.round(lens.reduce((a, b) => a + b) / lens.length), Math.max(...lens));
