# 🪐 Orbit Agent

**Standalone CLI agent. Original code. Original voice. Zero platform lock-in.**

Orbit is a terminal-native AI agent built from scratch — no LangChain, no Semantic Kernel, no wrapper. Just Node.js and a clean set of file/shell tools.

---

## 🚀 Quick Install (Linux / macOS)

**One command. Free. No API key needed.**

```bash
curl -fsSL https://raw.githubusercontent.com/tgoapple/orbit-agent/main/install.sh | bash
node src/cli.mjs
```

This will:
1. Install Node.js (if missing)
2. Install Ollama (if missing)
3. Download Orbit
4. Pull **Qwen2.5:7b** — free, local, runs entirely on your machine
5. Create a default `.env` — ready to go

**That's it.** No API keys. No accounts. No cloud dependencies.

---

## ⚙️ How It Works

You can run Orbit with either backend:

| Backend | Cost | API Key | Setup |
|---------|------|---------|-------|
| **Ollama** (default) | Free | None | `install.sh` does everything |
| **DeepSeek / OpenAI** | Pay-per-token | Required | Set `MODEL_BACKEND=api` + your key in `.env` |

### Ollama Mode (default — recommended for first use)

```bash
cd orbit-agent
node src/cli.mjs
```

Uses `qwen2.5:7b` locally. Runs offline. Unlimited usage.

### API Mode (DeepSeek / OpenAI / OpenRouter)

Edit `.env`:

```
MODEL_BACKEND=api
OPENAI_API_KEY=sk-your-key-here
OPENAI_BASE_URL=https://api.deepseek.com/v1    # or OpenAI / OpenRouter
OPENAI_MODEL=deepseek-chat                      # or gpt-4o / claude
```

Then run:

```bash
node src/cli.mjs
```

---

## Features

| Feature | What It Does |
|---------|-------------|
| **Tools system** | Read, write, list files. Run shell commands. Plan complex tasks. |
| **Skills library** | Load domain expertise on demand (skills/ folder) |
| **Session system** | Persistent conversations saved as JSON. Save/load/resume. |
| **Cross-platform** | Pure Node.js — runs on macOS, Linux, Windows |
| **Zero npm deps** | Uses only `fs`, `path`, `child_process`, `readline` — built-ins only |
| **Bridge ready** | Can communicate with other agents through `/tmp/agent-bridge.json` |

---

## Manual Setup

If you prefer to set up manually:

```bash
git clone https://github.com/tgoapple/orbit-agent
cd orbit-agent
cp .env.example .env
# edit .env to configure
node src/cli.mjs
```

**Prerequisites:**
- Node.js 18+
- Ollama (for local mode) or an API key (for API mode)

---

## Commands

Inside Orbit's chat:

```
/help       Show commands
/history    Show recent turns
/model      Show or change the active model
/save       Save the current session
/load       Load another session
/reset      Clear the current session
/exit       Quit
```

---

## License

MIT
