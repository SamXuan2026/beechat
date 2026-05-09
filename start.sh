#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUN_DIR="$ROOT_DIR/run"
LOG_DIR="$ROOT_DIR/logs"
PID_FILE="$RUN_DIR/beechat.pid"
LOG_FILE="$LOG_DIR/beechat.log"
PORT="${BEECHAT_PORT:-5188}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

mkdir -p "$RUN_DIR" "$LOG_DIR"

existing_pid="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
if [[ -n "$existing_pid" ]]; then
  echo "$existing_pid" >"$PID_FILE"
  echo "BeeChat 已运行：http://127.0.0.1:${PORT}"
  exit 0
fi

(
  cd "$ROOT_DIR"
  PORT="$PORT" nohup node server/index.js >"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
)

for _ in {1..20}; do
  if curl --silent --fail --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
    echo "BeeChat 已启动：http://127.0.0.1:${PORT}"
    echo "日志：$LOG_FILE"
    exit 0
  fi
  sleep 1
done

echo "BeeChat 启动失败，最近日志："
tail -n 40 "$LOG_FILE" 2>/dev/null || true
exit 1
