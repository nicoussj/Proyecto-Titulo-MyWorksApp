#!/usr/bin/env bash
# Idempotent bootstrap for the MyWorksApp monorepo (Flutter + React/Vite + Supabase).
# Runs once per environment build; the result is baked into the snapshot.
set -euo pipefail

FLUTTER_VERSION="3.47.7"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="$REPO_ROOT/MyWorksAppProyect"

echo "==> Installing Flutter ${FLUTTER_VERSION}"
if ! /opt/flutter/bin/flutter --version 2>/dev/null | grep -q "Flutter ${FLUTTER_VERSION}"; then
  sudo rm -rf /opt/flutter
  curl -fsSL -o /tmp/flutter.tar.xz \
    "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"
  sudo tar -xf /tmp/flutter.tar.xz -C /opt
  sudo chown -R "$(id -un):$(id -gn)" /opt/flutter
  rm -f /tmp/flutter.tar.xz
fi
sudo ln -sf /opt/flutter/bin/flutter /usr/local/bin/flutter
sudo ln -sf /opt/flutter/bin/dart /usr/local/bin/dart
git config --global --add safe.directory /opt/flutter
flutter config --no-analytics --enable-web >/dev/null 2>&1 || true

echo "==> Installing JavaScript workspaces (npm ci)"
for d in shared myworksapp_web myworksapp_desktop; do
  echo "    - $d"
  (cd "$APP_ROOT/$d" && npm ci)
done

echo "==> Preparing Vite .env.local files (Supabase demo keys from .env.example)"
for d in myworksapp_web myworksapp_desktop; do
  if [ ! -f "$APP_ROOT/$d/.env.local" ]; then
    cp "$APP_ROOT/$d/.env.example" "$APP_ROOT/$d/.env.local"
  fi
done

echo "==> Resolving Flutter dependencies (flutter pub get)"
(cd "$APP_ROOT/myworksapp_app" && flutter pub get)

echo "==> install.sh complete"
