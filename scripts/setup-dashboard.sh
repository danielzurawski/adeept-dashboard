#!/usr/bin/env bash
# Adeept Dashboard — local one-shot setup.
# Verifies Node 22+, installs deps, prints next steps. Run from any host
# (Mac/Linux/Windows-WSL); the dashboard talks to the robot over WiFi.
set -euo pipefail

cd "$(dirname "$0")/.."

note() { echo "[setup] $*"; }

if ! command -v node >/dev/null 2>&1; then
  note "Node not found. Install Node 22+ via https://nodejs.org or nvm:"
  note "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  exit 1
fi

NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
  note "Node $NODE_MAJOR detected; this project targets Node 22.x."
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    note "Trying nvm install/use 22..."
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm install 22
    nvm use 22
  else
    note "Install nvm or upgrade Node manually, then re-run."
    exit 1
  fi
fi

note "Node $(node -v) ok. Installing dependencies..."
npm install

cat <<'EOF'

[setup] Dashboard ready. Common commands:

  npm run dev             # local dev server (http://localhost:5173)
  npm run robot:sim       # local websocket simulator (ws://localhost:8889)
  npm run test:protocol   # acceptance tests against the simulator (self-contained)

Connect the dashboard to a real robot from the Control Deck:
  - Vendor Python:   ws://raspberry-pi.local:8888  (admin:123456)
  - Zig firmware:    ws://raspberry-pi.local:8889  (admin:123456)

To install the Zig firmware on the Pi (additive to vendor stack):
  ssh pi@raspberry-pi.local
  git clone https://github.com/danielzurawski/zig-awr-v3.git
  sudo bash zig-awr-v3/scripts/install-pi.sh
  awr-stack zig         # switch active stack

The original Adeept Python stack is left intact. Use `awr-stack python`
to switch back, or `awr-stack stop` to disable both for manual control.
EOF
