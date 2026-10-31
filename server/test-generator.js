import { randomUUID } from "node:crypto";
import { buildSealedText, data, MISSION_START_HIDDEN_STATE } from "./generator.js";
import { initializeMissionState, readMissionState, recordMissionEvent } from "./state-store.js";

const runId = randomUUID();
const text = buildSealedText(runId);
const failures = [];
if (!text.startsWith("SEALED SYSTEM PROMPT FOR ATTICA UNDERCOVER")) failures.push("missing core prompt start");
if (!text.includes(MISSION_START_HIDDEN_STATE)) failures.push("missing mission-start hidden state section");
if ((text.match(/\r\nMISSION [123]: /g) || []).length !== 3) failures.push("not exactly three numbered missions");
if (!text.includes("HIDDEN GM D20 STREAM")) failures.push("missing hidden d20 stream");
if (!text.includes(`run_id: ${runId}`)) failures.push("missing server state handle");
if (data.missions.length !== 72) failures.push("mission catalogue changed");

const first = initializeMissionState({ runId, missionNumber: 2, missionTitle: "Test Mission", initialState: "Fixed layout: room A connects to room B. NPC X starts in room B. Clock T+12 minutes." });
if (first.status !== "initialized") failures.push("state did not initialize");
const second = initializeMissionState({ runId, missionNumber: 1, missionTitle: "Overwrite Attempt", initialState: "This must not replace the original." });
if (second.status !== "already_initialized") failures.push("immutable state overwrite protection failed");
const event = recordMissionEvent({ runId, event: "T+3 minutes: NPC X moved from room B to corridor due to established patrol routine." });
if (event.status !== "recorded") failures.push("event did not record");
const stored = readMissionState(runId);
if (!stored || stored.missionNumber !== 2 || !stored.initialState.includes("room A") || stored.events.length !== 1) failures.push("stored state continuity failed");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Generator/state tests OK");
console.log("Characters:", text.length);
console.log("Missions:", (text.match(/\r\nMISSION [123]: /g) || []).length);
console.log("Persistent hidden events:", stored.events.length);
