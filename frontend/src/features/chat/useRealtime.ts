import { useEffect, useRef } from "react";
import type { RealtimeEvent } from "../../types/chat";

interface UseRealtimeOptions {
  enabled: boolean;
  onEvent: (event: RealtimeEvent) => void;
  token: string;
}

function realtimeUrl(token: string) {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/realtime?token=${encodeURIComponent(token)}`;
}

export function useRealtime({ enabled, onEvent, token }: UseRealtimeOptions) {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || !token || !window.WebSocket) return undefined;

    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let closedByEffect = false;

    function connect() {
      socket = new WebSocket(realtimeUrl(token));

      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data) as RealtimeEvent;
          if (payload.event === "connected") return;
          onEventRef.current(payload);
        } catch {
          // 忽略无法解析的实时消息，避免单条异常影响连接。
        }
      });

      socket.addEventListener("close", () => {
        if (closedByEffect) return;
        reconnectTimer = window.setTimeout(connect, 1500);
      });

      socket.addEventListener("error", () => {
        socket?.close();
      });
    }

    connect();

    return () => {
      closedByEffect = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled, token]);
}
