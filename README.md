Doesn't the read me keep repeating itself
# 🪐 Orbit Agent

**Standalone CLI agent. Original code. Original voice. Zero platform lock-in.**

Orbit is a terminal-native AI agent built from scratch — no LangChain, no Semantic Kernel, no wrapper. Just Node.js, DeepSeek (or any OpenAI-compatible API), and a clean set of file/shell tools.

He reads. He writes. He runs commands. He plans. He learns.

---

### Cross-Platform

| OS | Status | Notes |
|----|--------|-------|
| macOS | ✅ Tested | Works out of the box |
| Linux | ✅ Should work | Same Node.js APIs |
| Windows | ⚠️ Minor tweaks | Use `node src/cli.mjs` instead of `./orbit-agent` |

Orbit uses **zero npm dependencies** — just Node.js built-in modules (`fs`, `path`, `child_process`, `os`, `readline`, `fetch`). No `npm install` needed. If you have Node 18+, you have everything Orbit needs.


## 🚀 Quick Install (30 seconds)

### Prerequisites

- **Node.js 18+** — check with `node -v`
- **npm** — comes with Node.js
- **An API key** — DeepSeek, OpenAI, OpenRouter, or any OpenAI-compatible provider

### Step 1: Clone

```bash
git clone https://github.com/YOUR_USER/orbit-agent.git
cd orbit-agent
```

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Set up your API key

```bash
cp .env.example .env
```

Then edit `.env` with your API key. For DeepSeek (recommended — cheap, fast, good):

```env
OPENAI_API_KEY=sk-your-deepseek-key-here
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

For OpenAI:

```env
OPENAI_API_KEY=sk-your-openai-key-here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

### Step 4: Run

```bash
node src/cli.mjs
```

Or the shorthand:

```bash
./orbit-agent
```

That's it. You're talking to Orbit.

---

## 🎮 How to Use

### Interactive Mode (default)

```bash
./orbit-agent
```

Just start typing. Orbit responds, remembers the conversation, and uses tools when needed.

**In-session commands:**

| Command | What it does |
|---

### One-Shot Mode

Single response, no persistence:

```bash
./orbit-agent --one-shot "What's on my Desktop?"
```

### Named Sessions

Keep different conversations separate:

```bash
./orbit-agent --session coding
./orbit-agent --session trading
./orbit-agent --session personal
```

---

## 🧰 What Orbit Can Do

### Built-in Tools

| Tool | What it does |
|---

### Example: Building something

```
You: Build me a simple stopwatch HTML page on my Desktop
Orbit: Let me plan that out and build it.
       [uses plan tool, then supervise tool with write_file + open steps]
       Done. Open at ~/Desktop/stopwatch.html. It's a clean CSS stopwatch
       with lap functionality. Open it in your browser.
```

### Example: Using skills

```
You: I need help setting up a Discord bot
Orbit: Let me load the Discord skill.
       [uses load_skill("discord-skill")]
       Got it. Here's what you need...
```

---

## 📁 File Layout

```
orbit-agent/
├── src/
│   ├── cli.mjs               # Main entry — interactive REPL + one-shot
│   ├── tools.mjs              # All 8 tool implementations
│   ├── config.mjs             # Env-based configuration loader
│   ├── session-store.mjs      # Persistent JSON session storage
│   └── openai-client.mjs      # OpenAI-compatible API client
├── personas/
│   └── default.md             # System prompt — who Orbit is
├── data/
│   ├── memory.md              # Long-term memory (read at startup, write to remember)
│   └── sessions/              # Saved conversations (auto-managed)
├── SOUL.md                    # Identity document — read this one first
├── .env.example               # Copy to .env and add your API key
├── package.json               # Dependencies (just node-fetch)
└── README.md                  # You're here
```

---

## 🔧 Configuration Reference

All settings go in `.env` (copy from `.env.example`):

| Variable | Required | Default | Description |
|---

### Provider Examples

**DeepSeek** (recommended — $0.14/M tokens):
```env
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

**OpenAI**:
```env
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

**OpenRouter**:
```env
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=openai/gpt-4o-mini
```

**Any local model** (Ollama, LocalAI, etc.):
```env
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=qwen2.5:7b
```

---

## 🧠 Making Orbit Your Own

### Change his personality

Edit `personas/default.md` — this is his system prompt. Make him more formal, more technical, or completely different.

### Change his soul

Edit `SOUL.md` — this is his identity. The code stays the same, but who he *is* changes.

### Change his workspace

Set `WORKSPACE_ROOT` in `.env`:
```env
WORKSPACE_ROOT=~/Documents/Projects
```

### Add a skill library

Orbit can load skills on demand. Set `SKILL_DIR` to a folder containing skill folders, each with a `SKILL.md` file.

Want to create a skill? Just make a folder:
```
my-skills/
├── trading/
│   └── SKILL.md
├── design/
│   └── SKILL.md
└── sysadmin/
    └── SKILL.md
```

---

## 💬 Telegram Bridge (Optional)

Orbit can run as a Telegram bot. The bridge script (`orbit-telegram-bridge.mjs`) is not included in this repo, but the pattern is simple:

1. Create a bot with @BotFather on Telegram
2. Write a 200-line polling script: get updates from Telegram → write to bridge JSON → read response → send back
3. Run it as a background service

---

## 📦 Dependencies

Orbit has **one runtime dependency**: `node-fetch` (used only if running Node <18). Node 18+ uses the built-in `fetch`.

Everything else is native Node.js — `fs`, `path`, `child_process`, `os`.

---

## 🔒 Security Notes

- Your API key lives in `.env` — this file is in `.gitignore` so it never gets pushed
- File tools are scoped to `WORKSPACE_ROOT` — Orbit can't escape it
- All data stays local. No telemetry. No phone home.

---

## 📝 License

MIT — do whatever you want with it. Make it yours.

---

## 🪐 What People Say

> *"He's one day old and already making fish tanks."*
> — Orbit's creator, Day 1

> *"Good instinct. That's the right question to start with."*
> — Nicole, Orbit's mentor
