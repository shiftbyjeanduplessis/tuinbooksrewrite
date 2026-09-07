#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
PORT=8765
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "$PORT" >/tmp/tuinbooks-http.log 2>&1 &
elif command -v python >/dev/null 2>&1; then
  python -m http.server "$PORT" >/tmp/tuinbooks-http.log 2>&1 &
else
  echo "Python is required for the local OCR server."
  exit 1
fi
PID=$!
sleep 2
URL="http://localhost:$PORT/desktop.html"
if command -v open >/dev/null 2>&1; then open "$URL";
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL";
else echo "Open $URL in your browser."; fi
wait "$PID"
