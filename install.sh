#!/usr/bin/env bash
# ════════════════════════════════════════════════════════
#  🪐 Orbit Agent — Quick Install
#  Installs everything you need to run Orbit locally.
#  No API key required — uses Ollama + Qwen2.5 (free).
# ════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "  🪐  Orbit Agent Installer"
echo "  ─────────────────────────"
echo ""

# ── 1. Check / Install Node.js ──
if ! command -v node &>/dev/null; then
  echo -e "${BLUE}→ Installing Node.js...${NC}"
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v brew &>/dev/null; then
      brew install node
    else
      echo -e "${RED}Please install Homebrew first: https://brew.sh${NC}"
      exit 1
    fi
  else
    echo -e "${RED}Please install Node.js 18+ from https://nodejs.org${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
fi

# ── 2. Check / Install Ollama ──
if ! command -v ollama &>/dev/null; then
  echo -e "${BLUE}→ Installing Ollama...${NC}"
  curl -fsSL https://ollama.com/install.sh | sh
else
  echo -e "${GREEN}✓ Ollama installed${NC}"
fi

# ── 3. Clone Orbit (if not already present) ──
if [ -d "orbit-agent" ]; then
  echo -e "${GREEN}✓ orbit-agent directory exists${NC}"
  cd orbit-agent
else
  echo -e "${BLUE}→ Downloading Orbit...${NC}"
  git clone https://github.com/tgoapple/orbit-agent.git
  cd orbit-agent
fi

# ── 4. Pull Qwen2.5 model ──
echo -e "${BLUE}→ Pulling Qwen2.5 (free local model)...${NC}"
ollama pull qwen2.5:7b

# ── 5. Create .env with Ollama defaults ──
if [ ! -f ".env" ]; then
  cat > .env << 'ENVEOF'
# Orbit Agent Configuration (Ollama default — no API key)
MODEL_BACKEND=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
AGENT_NAME=Orbit
AGENT_SESSION_NAME=default
WORKSPACE_ROOT=.
ENVEOF
  echo -e "${GREEN}✓ Created .env with Ollama defaults${NC}"
else
  echo -e "${GREEN}✓ .env already exists${NC}"
fi

# ── 6. Start Ollama if not running ──
if ! curl -s http://127.0.0.1:11434/api/tags &>/dev/null; then
  echo -e "${BLUE}→ Starting Ollama...${NC}"
  ollama serve &
  sleep 3
fi

# ── 7. Done ──
echo ""
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo -e "${GREEN}  🪐 Orbit is ready!${NC}"
echo -e "${GREEN}══════════════════════════════════════${NC}"
echo ""
echo "  Run Orbit:"
echo "    cd orbit-agent && node src/cli.mjs"
echo ""
echo "  For API mode (DeepSeek/OpenAI/OpenRouter):"
echo "    Edit orbit-agent/.env and set:"
echo "      MODEL_BACKEND=api"
echo "      OPENAI_API_KEY=sk-your-key"
echo ""
