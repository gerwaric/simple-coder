import type { WSContext } from "hono/ws";
import { addUiClient, removeUiClient } from "./connections.js";

export function createUiWsHandlers() {
  let wsRef: WSContext | null = null;

  return {
    onOpen(_evt: Event, ws: WSContext) {
      wsRef = ws;
      addUiClient(ws);
    },

    onClose() {
      if (wsRef) removeUiClient(wsRef);
    },
  };
}
