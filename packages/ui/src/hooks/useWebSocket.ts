import { useEffect, useRef, useCallback } from "react";
import type { ServerToUI } from "@simple-coder/shared";

export function useWebSocket(onMessage: (msg: ServerToUI) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws/ui`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("[ws] connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerToUI;
        onMessageRef.current(msg);
      } catch {
        console.warn("[ws] failed to parse message", event.data);
      }
    };

    ws.onclose = () => {
      console.log("[ws] disconnected, reconnecting in 2s...");
      wsRef.current = null;
      setTimeout(connect, 2000);
    };

    ws.onerror = (err) => {
      console.error("[ws] error", err);
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
