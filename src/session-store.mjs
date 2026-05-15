import fs from "node:fs";
import path from "node:path";

function safeName(name) {
  return String(name || "default")
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-") || "default";
}

export function ensureDataDirs(dataDir) {
  fs.mkdirSync(path.join(dataDir, "sessions"), { recursive: true });
}

export function createEmptySession(name) {
  const now = new Date().toISOString();
  return {
    name: safeName(name),
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

function sessionPath(dataDir, name) {
  return path.join(dataDir, "sessions", `${safeName(name)}.json`);
}

export function loadSession(dataDir, name) {
  ensureDataDirs(dataDir);
  const file = sessionPath(dataDir, name);
  if (!fs.existsSync(file)) {
    return createEmptySession(name);
  }

  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    name: safeName(parsed.name || name),
    createdAt: parsed.createdAt || new Date().toISOString(),
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    messages: Array.isArray(parsed.messages) ? parsed.messages : []
  };
}

export function saveSession(dataDir, session) {
  ensureDataDirs(dataDir);
  const next = {
    ...session,
    name: safeName(session.name),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(sessionPath(dataDir, next.name), JSON.stringify(next, null, 2));
  return next;
}

export function listSessions(dataDir) {
  ensureDataDirs(dataDir);
  const dir = path.join(dataDir, "sessions");
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => file.replace(/\.json$/, ""))
    .sort();
}
