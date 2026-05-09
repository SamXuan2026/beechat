#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$ROOT_DIR/run/beechat.pid"
PORT="${BEECHAT_PORT:-5188}"

pid=""
if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE")"
fi

if [[ -z "$pid" ]]; then
  pid="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
fi

if [[ -z "$pid" ]]; then
  rm -f "$PID_FILE"
  echo "BeeChat 未运行"
  exit 0
fi

kill "$pid" 2>/dev/null || true

for _ in {1..10}; do
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    rm -f "$PID_FILE"
    echo "BeeChat 已停止"
    exit 0
  fi
  sleep 1
done

echo "BeeChat 停止超时，请检查 PID：${pid}"
exit 1
