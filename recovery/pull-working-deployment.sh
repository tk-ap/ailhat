#!/usr/bin/env bash
set -euo pipefail

BASE="${AILHAT_RECOVERY_BASE_URL:-https://ailhat-2lsg7ck7k-alvira2.vercel.app}"
OUT="${1:-recovery/deployed}"
mkdir -p "$OUT/assets"

# Preserve the exact deployed route HTML as a recovery artifact.
for route in root dashboard brief login; do
  case "$route" in
    root) path="/" ; file="$OUT/index.html" ;;
    dashboard) path="/dashboard" ; file="$OUT/dashboard.html" ;;
    brief) path="/brief" ; file="$OUT/brief.html" ;;
    login) path="/login" ; file="$OUT/login.html" ;;
  esac
  echo "Fetching $BASE$path"
  curl -fsSL "$BASE$path" -o "$file"
done

# Known build assets from the preserved working deployment.
assets=(
  "index-DLDj9J5u.js"
  "index-CN2fdGQM.js"
  "login-DSdRRAUp.js"
  "dashboard-Mh9fqY2b.js"
  "scanSite-tMNNgcFz.js"
  "useAuth-DOkPfkpf.js"
  "AuthNav-CSZ1oBO5.js"
  "brief-savJc-oI.js"
  "app-Ctmni3gE.css"
)

for asset in "${assets[@]}"; do
  echo "Fetching asset $asset"
  curl -fsSL "$BASE/assets/$asset" -o "$OUT/assets/$asset"
done

echo
printf 'Recovery complete: %s\n' "$OUT"
printf 'Preserved deployment: %s\n' "$BASE"
printf 'Verify asset integrity before using the artifact as a source reconstruction.\n'
