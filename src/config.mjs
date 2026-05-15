import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

export function loadEnvFile(filePath = path.join(projectRoot, ".env")) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function saveEnvValue(key, value, filePath = path.join(projectRoot, ".env")) {
  const nextLine = `${key}=${value}`;
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${nextLine}\n`, "utf8");
    process.env[key] = value;
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  let updated = false;
  const nextLines = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      updated = true;
      return nextLine;
    }
    return line;
  });

  if (!updated) {
    nextLines.push(nextLine);
  }

  fs.writeFileSync(filePath, `${nextLines.filter((line, index, arr) => !(index === arr.length - 1 && line === "")).join("\n")}\n`, "utf8");
  process.env[key] = value;
}

export function loadConfig() {
  loadEnvFile();

  return {
    projectRoot,
    agentName: process.env.AGENT_NAME || "Orbit",
    backend: process.env.MODEL_BACKEND || "",
    model: process.env.OPENAI_MODEL || "gpt-5.5",
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    ollamaBaseUrl: (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    ollamaModel: process.env.OLLAMA_MODEL || "",
    sessionName: process.env.AGENT_SESSION_NAME || "default",
    dataDir: path.join(projectRoot, "data"),
    personaFile: path.join(projectRoot, "personas", "default.md"),
    workspaceRoot: process.env.WORKSPACE_ROOT || path.resolve(projectRoot, "..")
  };
}
