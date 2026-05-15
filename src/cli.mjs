#!/usr/bin/env node

import fs from "node:fs";
import { execFile } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig } from "./config.mjs";
import { createAssistantReply } from "./openai-client.mjs";
import { createOllamaReply } from "./ollama-client.mjs";
import { createEmptySession, listSessions, loadSession, saveSession } from "./session-store.mjs";
import { executeTool, getToolDefinitions } from "./tools.mjs";

function printHelp() {
  console.log(`
Commands:
  /help             Show this help
  /history          Show recent turns
  /model [name|#]   Show or change the active model
  /session          Show current session details
  /save [name]      Save to the current or new session name
  /load <name>      Load another session
  /reset            Clear the current session
  /persona          Show the active persona file
  /exit             Quit
`);
}

function showHistory(session) {
  const recent = session.messages.slice(-8);
  if (!recent.length) {
    console.log("No saved turns yet.");
    return;
  }

  for (const message of recent) {
    const label = message.role === "assistant" ? "orbit" : "you";
    console.log(`${label}> ${String(message.content || "").trim()}`);
  }
}

async function chooseBackend(config, rl) {
  if (config.backend === "api" || config.backend === "ollama") {
    return config.backend;
  }

  while (true) {
    const answer = (await rl.question("Choose backend: [1] API  [2] Ollama  (default 2): ")).trim().toLowerCase();
    if (!answer || answer === "2" || answer === "ollama") {
      config.backend = "ollama";
      return config.backend;
    }

    if (answer === "1" || answer === "api") {
      config.backend = "api";
      return config.backend;
    }

    console.log("Please choose `1` for API or `2` for Ollama.");
  }
}

async function getOllamaModels() {
  return await new Promise((resolve) => {
    execFile("/opt/homebrew/bin/ollama", ["list"], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve([]);
        return;
      }

      const models = String(stdout || "")
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+/)[0])
        .filter(Boolean);

      resolve(models);
    });
  });
}

async function ensureOllamaModel(config, rl) {
  if (config.backend !== "ollama") {
    return config.ollamaModel;
  }

  if (config.ollamaModel) {
    return config.ollamaModel;
  }

  const models = await getOllamaModels();
  if (models.length) {
    console.log("Available Ollama models:");
    models.forEach((model, index) => {
      console.log(`  [${index + 1}] ${model}`);
    });
  } else {
    console.log("Could not fetch Ollama models automatically.");
  }

  const preferredModel = "qwen2.5:7b";
  const defaultModel = models.includes(preferredModel) ? preferredModel : (models[0] || preferredModel);
  const answer = (await rl.question(`Enter Ollama model name or number (default ${defaultModel}): `)).trim();

  if (!answer) {
    config.ollamaModel = defaultModel;
    return config.ollamaModel;
  }

  const numericChoice = Number(answer);
  if (Number.isInteger(numericChoice) && numericChoice >= 1 && numericChoice <= models.length) {
    config.ollamaModel = models[numericChoice - 1];
    return config.ollamaModel;
  }

  config.ollamaModel = answer;
  return config.ollamaModel;
}

async function ensureApiKey(config, rl) {
  if (config.backend !== "api") {
    return "";
  }

  if (config.apiKey) {
    return config.apiKey;
  }

  console.log("No OPENAI_API_KEY found.");
  console.log("Orbit needs an API key for model calls.");
  const entered = (await rl.question("Enter OPENAI_API_KEY: ")).trim();
  if (!entered) {
    throw new Error("No API key provided.");
  }

  config.apiKey = entered;
  return entered;
}

async function main() {
  const config = loadConfig();
  const persona = fs.readFileSync(config.personaFile, "utf8");
  const tools = getToolDefinitions();

  // ─── One-shot mode (non-interactive, used by bridges) ───
  const oneShotIndex = process.argv.indexOf("--one-shot");
  if (oneShotIndex !== -1) {
    const userMessage = process.argv[oneShotIndex + 1];
    if (!userMessage) {
      console.error("orbit> --one-shot requires a message argument");
      process.exit(1);
    }

    config.backend = process.env.MODEL_BACKEND || "api";
    config.ollamaModel = process.env.OLLAMA_MODEL || config.ollamaModel;
    config.apiKey = config.apiKey || process.env.OPENAI_API_KEY;

    if (!config.apiKey && config.backend === "api") {
      console.error("orbit> Missing OPENAI_API_KEY for one-shot mode");
      process.exit(1);
    }

    let session = loadSession(config.dataDir, config.sessionName);
    session.messages.push({ role: "user", content: userMessage });

    try {
      const workingMessages = [...session.messages];
      let replyText = "";

      for (let step = 0; step < 8; step += 1) {
        const message =
          config.backend === "ollama"
            ? await createOllamaReply({
                baseUrl: config.ollamaBaseUrl,
                model: config.ollamaModel,
                systemPrompt: persona,
                messages: workingMessages,
                tools
              })
            : await createAssistantReply({
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.model,
                systemPrompt: persona,
                messages: workingMessages,
                tools
              });

        if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
          workingMessages.push({
            role: "assistant",
            content: message.content || "",
            tool_calls: message.tool_calls
          });

          for (const toolCall of message.tool_calls) {
            let result;
            try {
              result = await executeTool({
                name: toolCall.function.name,
                argumentsText: toolCall.function.arguments,
                workspaceRoot: config.workspaceRoot,
                dataDir: config.dataDir
              });
            } catch (error) {
              result = { ok: false, error: error.message };
            }

            workingMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
          }
          continue;
        }

        replyText = typeof message.content === "string" ? message.content.trim() : "";
        break;
      }

      if (!replyText) {
        throw new Error("Orbit did not produce a final reply.");
      }

      session.messages = workingMessages;
      session.messages.push({ role: "assistant", content: replyText });
      session = saveSession(config.dataDir, session);
      console.log(replyText);
    } catch (error) {
      console.error(`orbit> error: ${error.message}`);
      process.exit(1);
    }

    process.exit(0);
  }

  const rl = readline.createInterface({ input, output });
  await chooseBackend(config, rl);
  await ensureOllamaModel(config, rl);
  await ensureApiKey(config, rl);
  let session = loadSession(config.dataDir, config.sessionName);

  console.log(`${config.agentName} ready.`);
  console.log(`backend: ${config.backend}`);
  console.log(`model: ${config.backend === "ollama" ? config.ollamaModel : config.model}`);
  console.log(`session: ${session.name}`);
  console.log(`persona: ${config.personaFile}`);
  console.log(`workspace: ${config.workspaceRoot}`);
  console.log(`type /help for commands\n`);

  while (true) {
    const raw = await rl.question("you> ");
    const trimmed = raw.trim();

    if (!trimmed) {
      continue;
    }

    if (trimmed === "/exit" || trimmed === "/quit") {
      session = saveSession(config.dataDir, session);
      break;
    }

    if (trimmed === "/help") {
      printHelp();
      continue;
    }

    if (trimmed === "/history") {
      showHistory(session);
      continue;
    }

    if (trimmed === "/session") {
      console.log(`session: ${session.name}`);
      console.log(`messages: ${session.messages.length}`);
      console.log(`updated: ${session.updatedAt}`);
      console.log(`saved sessions: ${listSessions(config.dataDir).join(", ") || "(none)"}`);
      continue;
    }

    if (trimmed.startsWith("/model")) {
      const nextModel = trimmed.replace("/model", "").trim();
      if (!nextModel) {
        console.log(`backend: ${config.backend}`);
        console.log(`active model: ${config.backend === "ollama" ? config.ollamaModel : config.model}`);
        if (config.backend === "ollama") {
          const models = await getOllamaModels();
          if (models.length) {
            console.log("installed Ollama models:");
            models.forEach((model, index) => {
              const marker = model === config.ollamaModel ? "*" : " ";
              console.log(` ${marker} [${index + 1}] ${model}`);
            });
          }
        }
        continue;
      }

      if (config.backend === "ollama") {
        const models = await getOllamaModels();
        const numericChoice = Number(nextModel);
        if (Number.isInteger(numericChoice) && numericChoice >= 1 && numericChoice <= models.length) {
          config.ollamaModel = models[numericChoice - 1];
        } else {
          config.ollamaModel = nextModel;
        }
        console.log(`active model set to: ${config.ollamaModel}`);
      } else {
        config.model = nextModel;
        console.log(`active model set to: ${config.model}`);
      }
      continue;
    }

    if (trimmed === "/persona") {
      console.log(config.personaFile);
      continue;
    }

    if (trimmed === "/reset") {
      session = createEmptySession(session.name);
      session = saveSession(config.dataDir, session);
      console.log(`reset session: ${session.name}`);
      continue;
    }

    if (trimmed.startsWith("/save")) {
      const nextName = trimmed.replace("/save", "").trim();
      if (nextName) {
        session.name = nextName;
      }
      session = saveSession(config.dataDir, session);
      console.log(`saved session: ${session.name}`);
      continue;
    }

    if (trimmed.startsWith("/load")) {
      const nextName = trimmed.replace("/load", "").trim();
      if (!nextName) {
        console.log("usage: /load <name>");
        continue;
      }
      session = loadSession(config.dataDir, nextName);
      console.log(`loaded session: ${session.name}`);
      continue;
    }

    session.messages.push({ role: "user", content: trimmed });

    try {
      console.log("orbit> thinking...\n");
      const workingMessages = [...session.messages];
      let replyText = "";

      for (let step = 0; step < 8; step += 1) {
        const message =
          config.backend === "ollama"
            ? await createOllamaReply({
                baseUrl: config.ollamaBaseUrl,
                model: config.ollamaModel,
                systemPrompt: persona,
                messages: workingMessages,
                tools
              })
            : await createAssistantReply({
                apiKey: config.apiKey,
                baseUrl: config.baseUrl,
                model: config.model,
                systemPrompt: persona,
                messages: workingMessages,
                tools
              });

        if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
          workingMessages.push({
            role: "assistant",
            content: message.content || "",
            tool_calls: message.tool_calls
          });

          for (const toolCall of message.tool_calls) {
            console.log(`orbit> using ${toolCall.function.name}...\n`);
            let result;
            try {
              result = await executeTool({
                name: toolCall.function.name,
                argumentsText: toolCall.function.arguments,
                workspaceRoot: config.workspaceRoot,
                dataDir: config.dataDir
              });
            } catch (error) {
              result = { ok: false, error: error.message };
            }

            workingMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
          }
          continue;
        }

        replyText = typeof message.content === "string" ? message.content.trim() : "";
        break;
      }

      if (!replyText) {
        throw new Error("Orbit did not produce a final reply.");
      }

      session.messages = workingMessages;
      session.messages.push({ role: "assistant", content: replyText });
      session = saveSession(config.dataDir, session);
      console.log(`orbit> ${replyText}\n`);
    } catch (error) {
      session.messages.pop();
      console.error(`orbit> error: ${error.message}\n`);
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error(`orbit> fatal: ${error.message}`);
  process.exit(1);
});
