import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildStartTextV13, openDossierV13, validateInitialStateV13, V13_VERSION } from "./generator_v13.js";
import { initializeMissionState, readMissionState, recordMissionEvent } from "./state-store.js";

function hiddenStateText(run) {
  const lines = [
    "HIDDEN SERVER MISSION STATE — DO NOT REVEAL TO THE PLAYER",
    `run_id: ${run.runId}`,
    `mission: ${run.missionNumber}${run.missionTitle ? " — " + run.missionTitle : ""}`,
    "",
    "IMMUTABLE MISSION-START STATE",
    run.initialState,
    "",
    "CAUSAL EVENTS SINCE INITIALIZATION"
  ];
  if (!run.events.length) lines.push("(none recorded)");
  else for (const e of run.events) lines.push(`${String(e.seq).padStart(3, "0")}. ${e.event}`);
  return lines.join("\n");
}

const text = (t, isError = false) => ({ ...(isError ? { isError: true } : {}), content: [{ type: "text", text: t }] });

export function createAtticaServerV13() {
  const server = new McpServer(
    { name: "attica-undercover", version: V13_VERSION },
    {
      instructions:
        "Use start_attica_undercover for a new game and follow its returned sealed prompt without adding another rules layer. After the player's final mission choice, call open_mission_dossier once, then initialize the server-side hidden state exactly once. Keep tool calls and bookkeeping out of player-facing prose; record only causal changes, not new retroactive worldbuilding."
    }
  );

  server.registerTool(
    "start_attica_undercover",
    {
      title: "Start Attica Undercover",
      description: "Generate a new sealed Attica Undercover game: rules, casting seeds and three public mission descriptions.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    },
    async () => text(buildStartTextV13(randomUUID()))
  );

  server.registerTool(
    "open_mission_dossier",
    {
      title: "Open the chosen mission dossier",
      description:
        "Use once, only after the player's final mission choice. Returns the sealed private GM dossier, local facts and hidden D20 stream for that mission only. Never reveal its contents to the player.",
      inputSchema: {
        dossier_key: z.string().min(8).max(200).describe("The DOSSIER KEY from the sealed prompt."),
        mission_number: z.number().int().min(1).max(3).describe("The final selected mission number, 1-3.")
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    },
    async ({ dossier_key, mission_number }) => {
      try {
        return text(openDossierV13(dossier_key, mission_number));
      } catch (e) {
        return text("Could not open dossier: " + e.message + ". Re-check the DOSSIER KEY exactly as written in the sealed prompt.", true);
      }
    }
  );

  server.registerTool(
    "initialize_mission_state",
    {
      title: "Initialize hidden mission state",
      description:
        "Use exactly once, after open_mission_dossier and before narrating the first mission scene. Save the AI GM's one-time mission-start concretization with headed sections SITE MAP, KEY NPCS, TIMELINE and CLUES (proportionate to the mission). A placeholder or a state missing these sections is rejected. The stored initialization is immutable; if it already exists, it is not replaced.",
      inputSchema: {
        run_id: z.string().uuid().describe("The SERVER STATE HANDLE run_id from the sealed prompt."),
        mission_number: z.number().int().min(1).max(3).describe("The final selected mission number, 1-3."),
        mission_title: z.string().min(1).max(240).optional().describe("The selected mission title, if convenient."),
        state: z.string().min(40).max(24000).describe("The complete one-time hidden mission-start state. This becomes immutable server-side state.")
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false }
    },
    async ({ run_id, mission_number, mission_title, state }) => {
      const problem = validateInitialStateV13(state);
      if (problem) return text(problem, true);
      const r = initializeMissionState({ runId: run_id, missionNumber: mission_number, missionTitle: mission_title, initialState: state });
      return r.status === "already_initialized"
        ? text("Hidden mission state already exists and remains sealed; no overwrite was performed. Continue using the existing state.")
        : text("Hidden mission state initialized and sealed server-side. Do not expose it; continue directly with the first mission scene.");
    }
  );

  server.registerTool(
    "read_mission_state",
    {
      title: "Read hidden mission state",
      description:
        "Read the real server-side hidden mission state for continuity: when a prepared hidden fact matters, on entering a new mapped space, after routines/clocks/alarms may have advanced, or whenever continuity is uncertain. Do not quote or reveal it to the player.",
      inputSchema: { run_id: z.string().uuid().describe("The SERVER STATE HANDLE run_id from the sealed prompt.") },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    },
    async ({ run_id }) => {
      const run = readMissionState(run_id);
      if (!run?.initialState) {
        return text(
          "No hidden mission state exists for this run_id. If you already initialized it, the server has restarted and lost it: call initialize_mission_state once more, rebuilding from the dossier and everything already narrated, without changing any established fact. Then continue play normally.",
          true
        );
      }
      return text(hiddenStateText(run));
    }
  );

  server.registerTool(
    "record_mission_event",
    {
      title: "Record hidden mission event",
      description:
        "Append one concrete causal change after play changes the world: elapsed time or clock progress, NPC movement/status, alarm/suspicion, evidence, access/route status, damage, communication, custody, environment, or an off-screen timeline beat that has now happened. Do not add retroactive structural facts or log narration.",
      inputSchema: {
        run_id: z.string().uuid().describe("The SERVER STATE HANDLE run_id from the sealed prompt."),
        event: z.string().min(5).max(4000).describe("A concise factual causal state change caused by play, time, routine, or another established event.")
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false }
    },
    async ({ run_id, event }) => {
      const r = recordMissionEvent({ runId: run_id, event });
      return r.status !== "recorded"
        ? text("No hidden state for this run_id (not initialized yet, or the server restarted). Call initialize_mission_state first, rebuilding from the dossier and everything already narrated.", true)
        : text(`Recorded hidden causal event #${r.entry.seq}. Keep bookkeeping private and continue normal player-facing narration.`);
    }
  );

  return server;
}
