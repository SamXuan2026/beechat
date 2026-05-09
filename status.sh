#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT_DIR/run/beechat.pid"
PORT="${BEECHAT_PORT:-5188}"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"

pid=""
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
fi

if [[ -z "$pid" ]] || ! kill -0 "$pid" >/dev/null 2>&1; then
  pid="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$pid" ]]; then
  echo "BeeChat：未运行"
  exit 1
fi

if curl --silent --fail --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
  echo "BeeChat：运行正常（PID ${pid}）- http://127.0.0.1:${PORT}"
  exit 0
fi

echo "BeeChat：进程存在但健康检查失败（PID ${pid}）"
exit 1
