#!/usr/bin/env bash

echo "======================================================="
echo "   ⚡ Antigravity Chat Studio & Project Organizer"
echo "======================================================="
echo ""
echo "[1/2] Starting local dashboard server..."
echo ""

# Open default browser based on OS
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "http://localhost:4949" &
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "http://localhost:4949" &
fi

node server.js
