import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { buildSealedText } from "./generator.js";
import { initializeMissionState, readMissionState, recordMissionEvent } from "./state-store.js";
import { createAtticaServerV13 } from "./server_v13.js";

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

function createAtticaServer() {
  const server = new McpServer(
    { name: "attica-undercover", version: "12.2.0" },
    {
      instructions:
        "Use start_attica_undercover for a new game and follow its returned sealed prompt without adding another rules layer. After the player's final mission choice, initialize the server-side hidden state exactly once. Keep hidden-state tool calls and bookkeeping out of player-facing prose; record only causal changes, not new retroactive worldbuilding."
    }
  );

  server.registerTool(
    "start_attica_undercover",
    {
      title: "Start Attica Undercover",
      description: "Generate a new complete sealed Attica Undercover game prompt.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async () => {
      const runId = randomUUID();
      return {
        content: [{ type: "text", text: buildSealedText(runId) }]
      };
    }
  );

  server.registerTool(
    "initialize_mission_state",
    {
      title: "Initialize hidden mission state",
      description:
        "Use exactly once, only after the player has made the final choice of one of the three missions and before narrating the first mission scene. Save the AI GM's one-time mission-start concretization here. The stored initialization is immutable; if it already exists, do not replace it. Keep it compact but concrete and include whatever hidden prepared facts are useful (layout/secondary spaces/access, NPC starting positions or minor supporting NPCs, routines, clocks/thresholds, environment, or other mission-specific facts) without altering the sealed dossier or inventing convenience solutions.",
      inputSchema: {
        run_id: z.string().uuid().describe("The SERVER STATE HANDLE run_id from the sealed prompt."),
        mission_number: z.number().int().min(1).max(3).describe("The final selected mission number, 1-3."),
        mission_title: z.string().min(1).max(240).optional().describe("The selected mission title, if convenient."),
        state: z.string().min(40).max(16000).describe("The complete one-time hidden mission-start state. This becomes immutable server-side state.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({ run_id, mission_number, mission_title, state }) => {
      const result = initializeMissionState({
        runId: run_id,
        missionNumber: mission_number,
        missionTitle: mission_title,
        initialState: state
      });
      if (result.status === "already_initialized") {
        return {
          content: [{ type: "text", text: "Hidden mission state already exists and remains sealed; no overwrite was performed. Continue using the existing state." }]
        };
      }
      return {
        content: [{ type: "text", text: "Hidden mission state initialized and sealed server-side. Do not expose it; continue directly with the first mission scene." }]
      };
    }
  );

  server.registerTool(
    "read_mission_state",
    {
      title: "Read hidden mission state",
      description:
        "Read the real server-side hidden mission state for continuity. Use after initialization when a prepared hidden fact matters, on entering a new prepared area, after routines/clocks/alarms may have advanced, or whenever continuity is uncertain. Do not quote or reveal the returned bookkeeping to the player.",
      inputSchema: {
        run_id: z.string().uuid().describe("The SERVER STATE HANDLE run_id from the sealed prompt.")
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({ run_id }) => {
      const run = readMissionState(run_id);
      if (!run?.initialState) {
        return {
          isError: true,
          content: [{ type: "text", text: "No initialized hidden mission state exists for this run_id." }]
        };
      }
      return {
        content: [{ type: "text", text: hiddenStateText(run) }]
      };
    }
  );

  server.registerTool(
    "record_mission_event",
    {
      title: "Record hidden mission event",
      description:
        "Append one concrete causal change to the existing hidden mission state after play changes the world: elapsed time or clock progress, NPC movement/status, alarm/suspicion, evidence, access/route status, damage, communication, custody, environment, or another established consequence. Do not use this to add retroactive structural facts, rewrite the immutable initialization, log narration, or record facts that did not change.",
      inputSchema: {
        run_id: z.string().uuid().describe("The SERVER STATE HANDLE run_id from the sealed prompt."),
        event: z.string().min(5).max(4000).describe("A concise factual causal state change caused by play, time, routine, or another established event.")
      },
      annotations: {
        readOnlyHint: false,
        openWorldHint: false,
        destructiveHint: false
      }
    },
    async ({ run_id, event }) => {
      const result = recordMissionEvent({ runId: run_id, event });
      if (result.status !== "recorded") {
        return {
          isError: true,
          content: [{ type: "text", text: "Cannot record an event before initialize_mission_state has created the hidden mission state for this run_id." }]
        };
      }
      return {
        content: [{ type: "text", text: `Recorded hidden causal event #${result.entry.seq}. Keep bookkeeping private and continue normal player-facing narration.` }]
      };
    }
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";
// v13 profile is served side by side for A/B play; /mcp stays v12.2.
const MCP_PATHS = { "/mcp": createAtticaServer, "/mcp-v13": createAtticaServerV13 };

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "OPTIONS" && MCP_PATHS[url.pathname]) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("Attica Undercover MCP server v12.2.0 (/mcp) + v13.0.0 (/mcp-v13)");
    return;
  }

  const methods = new Set(["POST", "GET", "DELETE"]);
  if (MCP_PATHS[url.pathname] && req.method && methods.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = MCP_PATHS[url.pathname]();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`Attica Undercover MCP v12.2.0 listening on http://localhost:${port}${MCP_PATH}`);
});
