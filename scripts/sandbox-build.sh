#!/usr/bin/env bash
# Static-first sandbox build for here.now (see .agent-os/deployment.yaml).
# Production uses vite.config.ts and build-vercel.sh and is not affected.
set -euo pipefail
cd "$(dirname "$0")/.."
bun install
bunx vite build -c vite.sandbox.config.ts
[ -f dist/client/index.html ] || cp dist/client/_shell.html dist/client/index.html
echo "Static sandbox build ready: dist/client"
