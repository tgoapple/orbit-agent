import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec, spawn } from "node:child_process";

const SKILL_DIR = process.env.SKILL_DIR || path.join(os.homedir(), ".openclaw", "workspace", "skills");

function readSkill(skillName) {
  const skillPath = path.join(SKILL_DIR, skillName, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    const dirs = fs.readdirSync(SKILL_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
    return {
      ok: false,
      error: `No skill named "${skillName}"`,
      availableSkills: dirs
    };
  }
  const content = fs.readFileSync(skillPath, "utf8");
  return {
    ok: true,
    name: skillName,
    path: skillPath,
    content: trimOutput(content, 60000)
  };
}

function listSkills() {
  const dirs = fs.readdirSync(SKILL_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
  return {
    ok: true,
    skills: dirs,
    count: dirs.length
  };
}

function resolveInsideWorkspace(workspaceRoot, targetPath = ".") {
  const base = path.resolve(workspaceRoot);
  const resolved = path.resolve(base, targetPath);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path is outside workspace root: ${targetPath}`);
  }
  return resolved;
}

function trimOutput(text, limit = 12000) {
  const value = String(text || "");
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}\n...output truncated...`;
}

export function getToolDefinitions() {
  return [
    {
      type: "function",
      function: {
        name: "list_files",
        description: "List files and directories inside the workspace.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path inside the workspace. Defaults to ." }
          }
        }
      }
    },
    {
      type: "function",
      function: {
        name: "read_file",
        description: "Read a text file inside the workspace.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path inside the workspace." }
          },
          required: ["path"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "write_file",
        description: "Create or overwrite a text file inside the workspace.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Relative path inside the workspace." },
            content: { type: "string", description: "Full file content to write." }
          },
          required: ["path", "content"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "run_command",
        description: "Run a shell command inside the workspace using zsh.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "Shell command to run." },
            cwd: { type: "string", description: "Relative working directory inside the workspace." },
            timeout_ms: { type: "number", description: "Optional timeout in milliseconds. Default 20000." }
          },
          required: ["command"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "communicate",
        description: "Write a structured message to Orbit's local communication outbox for another person, process, or future workflow.",
        parameters: {
          type: "object",
          properties: {
            recipient: { type: "string", description: "Who the message is for." },
            message: { type: "string", description: "What Orbit wants to communicate." }
          },
          required: ["recipient", "message"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "load_skill",
        description: "Load a skill file into context. Skills are markdown guides for specific topics, tools, or workflows. Use this when you need domain-specific knowledge for a task. Pass an empty string to list all available skills.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the skill to load (folder name in the skills directory). Pass empty string to list all available skills." }
          },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "supervise",
        description: "Break a multi-step task into sub-steps and execute them in sequence. Use this when a single command or file write isn't enough — e.g. build something new, investigate a problem, or run a multi-stage process. Each step runs in order and can depend on the previous step's output.",
        parameters: {
          type: "object",
          properties: {
            task_name: { type: "string", description: "A short, descriptive name for this supervised task." },
            steps: {
              type: "array",
              description: "List of steps to execute in order. Each step's output is available to subsequent steps.",
              items: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: ["command", "write_file", "read_file"],
                    description: "What this step does."
                  },
                  description: { type: "string", description: "What this step should accomplish." },
                  command: { type: "string", description: "Shell command to run (if action is 'command')." },
                  path: { type: "string", description: "File path relative to workspace root (if action is 'write_file' or 'read_file')." },
                  content: { type: "string", description: "File content (if action is 'write_file')." }
                },
                required: ["action", "description"]
              }
            },
            stop_on_error: { type: "boolean", description: "If true, stop at the first failed step. Default true." }
          },
          required: ["task_name", "steps"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "plan",
        description: "Create a structured plan for a complex task before executing it. Use this when a task is large enough that you need to think through the steps first. Saves the plan to your data directory for review.",
        parameters: {
          type: "object",
          properties: {
            goal: { type: "string", description: "What you're trying to achieve." },
            steps: {
              type: "array",
              items: { type: "string" },
              description: "Ordered list of high-level steps."
            },
            estimated_complexity: {
              type: "string",
              enum: ["simple", "moderate", "complex"],
              description: "How involved this is."
            }
          },
          required: ["goal", "steps"]
        }
      }
    }
  ];
}

function listFiles({ workspaceRoot, args }) {
  const target = resolveInsideWorkspace(workspaceRoot, args.path || ".");
  const entries = fs
    .readdirSync(target, { withFileTypes: true })
    .map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file"
    }));

  return {
    ok: true,
    path: target,
    entries
  };
}

function readFileTool({ workspaceRoot, args }) {
  const target = resolveInsideWorkspace(workspaceRoot, args.path);
  const content = fs.readFileSync(target, "utf8");
  return {
    ok: true,
    path: target,
    content: trimOutput(content, 30000)
  };
}

function writeFileTool({ workspaceRoot, args }) {
  const target = resolveInsideWorkspace(workspaceRoot, args.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, args.content, "utf8");
  return {
    ok: true,
    path: target,
    bytes: Buffer.byteLength(args.content, "utf8")
  };
}

async function runCommandTool({ workspaceRoot, args }) {
  const cwd = resolveInsideWorkspace(workspaceRoot, args.cwd || ".");
  const timeout = Number(args.timeout_ms || 20000);

  return await new Promise((resolve) => {
    exec(args.command, { cwd, shell: "/bin/zsh", timeout, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        cwd,
        command: args.command,
        exitCode: error?.code ?? 0,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr),
        error: error ? String(error.message || error) : null
      });
    });
  });
}

function communicateTool({ dataDir, args }) {
  const dir = path.join(dataDir, "communications");
  const file = path.join(dir, "outbox.jsonl");
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    createdAt: new Date().toISOString(),
    recipient: String(args.recipient || "").trim(),
    message: String(args.message || "").trim()
  };
  fs.appendFileSync(file, `${JSON.stringify(payload)}\n`);
  return {
    ok: true,
    file,
    payload
  };
}

export async function executeTool({ name, argumentsText, workspaceRoot, dataDir }) {
  let args = {};
  try {
    args = argumentsText ? JSON.parse(argumentsText) : {};
  } catch {
    throw new Error(`Invalid tool arguments for ${name}`);
  }

  if (name === "list_files") {
    return listFiles({ workspaceRoot, args });
  }

  if (name === "read_file") {
    return readFileTool({ workspaceRoot, args });
  }

  if (name === "write_file") {
    return writeFileTool({ workspaceRoot, args });
  }

  if (name === "run_command") {
    return await runCommandTool({ workspaceRoot, args });
  }

  if (name === "communicate") {
    return communicateTool({ dataDir, args });
  }

  if (name === "load_skill") {
    const skillName = String(args.name || "").trim();
    if (!skillName) {
      return listSkills();
    }
    return readSkill(skillName);
  }

  if (name === "supervise") {
    return await superviseTool({ workspaceRoot, dataDir, args });
  }

  if (name === "plan") {
    return planTool({ dataDir, args });
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function superviseTool({ workspaceRoot, dataDir, args }) {
  const taskName = String(args.task_name || "untitled").replace(/[^a-zA-Z0-9-_ ]/g, "-");
  const steps = Array.isArray(args.steps) ? args.steps : [];
  const stopOnError = args.stop_on_error !== false;

  if (steps.length === 0) {
    return { ok: false, error: "No steps provided. Add at least one step." };
  }

  const results = [];
  let overallOk = true;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepResult = { step: i + 1, description: step.description, action: step.action, ok: false, output: null, error: null };

    try {
      if (step.action === "command") {
        if (!step.command) {
          stepResult.error = "No command provided for this step.";
        } else {
          const cwd = resolveInsideWorkspace(workspaceRoot, step.cwd || ".");
          const timeout = Number(step.timeout_ms || 30000);
          stepResult.output = await new Promise((resolve) => {
            exec(step.command, { cwd, shell: "/bin/zsh", timeout, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
              resolve({
                exitCode: error?.code ?? 0,
                stdout: trimOutput(stdout, 40000),
                stderr: trimOutput(stderr, 10000),
                error: error ? String(error.message || error) : null
              });
            });
          });
          stepResult.ok = !stepResult.output.error;
        }
      } else if (step.action === "write_file") {
        if (!step.path || step.content === undefined) {
          stepResult.error = "write_file requires both 'path' and 'content'";
        } else {
          const target = resolveInsideWorkspace(workspaceRoot, step.path);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, step.content, "utf8");
          stepResult.output = { path: target, bytes: Buffer.byteLength(step.content, "utf8") };
          stepResult.ok = true;
        }
      } else if (step.action === "read_file") {
        if (!step.path) {
          stepResult.error = "read_file requires 'path'";
        } else {
          const target = resolveInsideWorkspace(workspaceRoot, step.path);
          stepResult.output = { path: target, content: trimOutput(fs.readFileSync(target, "utf8"), 30000) };
          stepResult.ok = true;
        }
      } else {
        stepResult.error = `Unknown action: ${step.action}`;
      }
    } catch (err) {
      stepResult.error = String(err.message || err);
    }

    results.push(stepResult);

    if (!stepResult.ok && stopOnError) {
      overallOk = false;
      break;
    }
  }

  return {
    ok: overallOk,
    task_name: taskName,
    steps_total: steps.length,
    steps_completed: results.length,
    results
  };
}

function planTool({ dataDir, args }) {
  const goal = String(args.goal || "").trim();
  const steps = Array.isArray(args.steps) ? args.steps : [];
  const complexity = String(args.estimated_complexity || "moderate");

  const plan = {
    goal,
    complexity,
    steps,
    createdAt: new Date().toISOString()
  };

  const dir = path.join(dataDir, "plans");
  fs.mkdirSync(dir, { recursive: true });
  const slug = goal.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "plan";
  const file = path.join(dir, `${slug}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(plan, null, 2));

  return {
    ok: true,
    plan_file: file,
    goal,
    complexity,
    steps_count: steps.length
  };
}
