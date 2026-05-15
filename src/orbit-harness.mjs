#!/usr/bin/env node
/**
 * orbit-harness.mjs — Persistent daemon for Orbit
 *
 * Keeps Orbit alive in memory so every message doesn't need a cold start.
 * Listens on a local TCP port for messages, responds immediately.
 *
 * Usage:
 *   node src/orbit-harness.mjs              # Start daemon (default port 12999)
 *   node src/orbit-harness.mjs --port 7899  # Custom port
 *   echo 'Hello' | nc localhost 12999       # Send message, get response
 *
 * Environment variables:
 *   ORBIT_DIR    Path to orbit-agent root (default: parent of src/)
 *   HARNESS_PORT TCP port (default: 12999)
 *
 * Requires API keys set as usual via .env or OPENAI_API_KEY.
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Resolve paths ──
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORBIT_DIR = process.env.ORBIT_DIR || path.resolve(__dirname, "..");
const PORT = parseInt(process.env.HARNESS_PORT) || getPortFromArgs() || 12999;

function getPortFromArgs() {
  const idx = process.argv.indexOf("--port");
  if (idx !== -1 && process.argv[idx + 1]) return parseInt(process.argv[idx + 1]);
  return null;
}

// Resolve module paths
const modules = {
  config: new URL("src/config.mjs", `file://${ORBIT_DIR}/`).href,
  client: new URL("src/openai-client.mjs", `file://${ORBIT_DIR}/`).href,
  tools: new URL("src/tools.mjs", `file://${ORBIT_DIR}/`).href,
  session: new URL("src/session-store.mjs", `file://${ORBIT_DIR}/`).href,
};

// ── State ──
let persona = "";
let tools = [];
let session = null;
let config = null;
let createAssistantReply = null;
let loadSession = null;
let saveSession = null;
let executeTool = null;
let initialized = false;
let busy = false;
const queue = [];

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  process.stderr.write(`[${ts}] ${msg}\n`);
}

// ── Init ──
async function init() {
  if (initialized) return;
  initialized = true;

  const { loadConfig } = await import(modules.config);
  const client = await import(modules.client);
  const toolsMod = await import(modules.tools);
  const sessionMod = await import(modules.session);

  config = loadConfig();
  persona = fs.readFileSync(config.personaFile, "utf8");
  tools = toolsMod.getToolDefinitions ? toolsMod.getToolDefinitions() : [];
  createAssistantReply = client.createAssistantReply;
  loadSession = sessionMod.loadSession;
  saveSession = sessionMod.saveSession;
  executeTool = toolsMod.executeTool;

  config.backend = "api";
  config.sessionName = config.sessionName || "default";
  config.apiKey = config.apiKey || process.env.OPENAI_API_KEY;

  session = loadSession(config.dataDir, config.sessionName);
  log(`init: model=${config.model} session="${session.name}" (${session.messages.length} messages)`);
}

// ── Process one message ──
async function processMessage(text) {
  await init();
  busy = true;

  try {
    session.messages.push({ role: "user", content: text });
    const workingMessages = [...session.messages];
    let replyText = "";

    for (let step = 0; step < 8; step++) {
      const message = await createAssistantReply({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        systemPrompt: persona,
        messages: workingMessages,
        tools,
      });

      if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        workingMessages.push({
          role: "assistant",
          content: message.content || "",
          tool_calls: message.tool_calls,
        });

        for (const toolCall of message.tool_calls) {
          let result;
          try {
            result = executeTool
              ? await executeTool({
                  name: toolCall.function.name,
                  argumentsText: toolCall.function.arguments,
                  workspaceRoot: config.workspaceRoot,
                  dataDir: config.dataDir,
                })
              : { ok: false, error: "executeTool not available" };
          } catch (error) {
            result = { ok: false, error: error.message };
          }
          workingMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      replyText = typeof message.content === "string" ? message.content.trim() : "";
      break;
    }

    if (!replyText) throw new Error("Orbit did not produce a final reply.");

    session.messages = workingMessages;
    session.messages.push({ role: "assistant", content: replyText });
    session = saveSession(config.dataDir, session);
    return { ok: true, reply: replyText };
  } catch (error) {
    session.messages.pop();
    return { ok: false, error: error.message };
  } finally {
    busy = false;
    if (queue.length > 0) {
      const next = queue.shift();
      const result = await processMessage(next.text);
      next.socket.write(JSON.stringify(result) + "\n");
    }
  }
}

// ── Handle connection ──
function handleConnection(socket) {
  let buffer = "";

  socket.on("data", async (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let text = trimmed;
      try {
        const parsed = JSON.parse(trimmed);
        text = parsed.msg || parsed.message || parsed.text || trimmed;
      } catch {}

      if (busy) {
        await new Promise((resolve) => queue.push({ text, socket, resolve }));
      } else {
        const result = await processMessage(text);
        socket.write(JSON.stringify(result) + "\n");
      }
    }
  });

  socket.on("error", (err) => log(`socket error: ${err.message}`));
}

// ── Main ──
async function main() {
  await init();

  const server = net.createServer(handleConnection);
  server.listen(PORT, "127.0.0.1", () => {
    log(`Orbit daemon listening on 127.0.0.1:${PORT} (PID: ${process.pid})`);
    log(`Send: echo '{"msg":"hello"}' | nc localhost ${PORT}`);
  });

  const shutdown = () => {
    log("shutting down... saving session");
    if (session) saveSession(config.dataDir, session);
    server.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log(`fatal: ${err.message}`);
  process.exit(1);
});
