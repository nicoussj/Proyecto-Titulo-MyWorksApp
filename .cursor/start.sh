#!/usr/bin/env bash
# Launches the three MyWorksApp dev servers on every agent boot.
# Idempotent: each server runs in its own tmux session and is skipped if already up.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="$REPO_ROOT/MyWorksAppProyect"

start_session() {
  local name="$1" dir="$2" cmd="$3"
  if tmux has-session -t "$name" 2>/dev/null; then
    echo "==> $name already running"
  else
    echo "==> starting $name"
    tmux new-session -d -s "$name" -c "$dir" "$cmd"
  fi
}

# Client web app (React/Vite)  -> http://localhost:5173
start_session web "$APP_ROOT/myworksapp_web" \
  "npm run dev -- --host 0.0.0.0 2>&1 | tee /tmp/web-dev.log"

# Admin desktop hub (React/Vite, also packaged with Tauri) -> http://127.0.0.1:3001
start_session desktop "$APP_ROOT/myworksapp_desktop" \
  "npm run dev 2>&1 | tee /tmp/desktop-dev.log"

# Flutter mobile client compiled to web -> http://localhost:8080
start_session flutter "$APP_ROOT/myworksapp_app" \
  "flutter run -d web-server --web-port 8080 --web-hostname 0.0.0.0 2>&1 | tee /tmp/flutter-web.log"

echo "==> start.sh launched all dev servers (web:5173 desktop:3001 flutter:8080)"
