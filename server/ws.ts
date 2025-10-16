import type { IncomingMessage } from "http";
import type { Server as HttpServer } from "http";
import type {
  AckMessage,
  Client,
  CommandMessage,
  InboundMessage,
  StateMessage,
} from "./types";

import { URL } from "url";

import { WebSocketServer, WebSocket } from "ws";

import { Broker, createClientId } from "./broker";
import { verifyToken } from "./auth";

interface WebSocketInitOptions {
  path?: string;
  heartbeatIntervalMs?: number;
  allowedOrigins?: string[];
  broker?: Broker;
}

const DEFAULT_PATH = "/ws";
const DEFAULT_HEARTBEAT_MS = 15000;
const MAX_PAYLOAD_BYTES = 64 * 1024;

function parseAllowedOrigins(): string[] | undefined {
  const raw = process.env.WS_ALLOWED_ORIGINS;

  if (!raw) return undefined;

  return raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function isOriginAllowed(
  originHeader: string | undefined,
  allowedOrigins?: string[],
): boolean {
  if (!allowedOrigins || allowedOrigins.length === 0) {
    return true;
  }
  if (!originHeader) return false;

  return allowedOrigins.some((allowed) => originHeader.startsWith(allowed));
}

export function initWebSocketServer(
  server: HttpServer,
  options: WebSocketInitOptions = {},
): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: options.path ?? DEFAULT_PATH,
    maxPayload: MAX_PAYLOAD_BYTES,
  });

  const broker = options.broker ?? new Broker();
  const allowedOrigins = options.allowedOrigins ?? parseAllowedOrigins();
  const heartbeatInterval = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_MS;

  wss.on("connection", (ws, req) => {
    if (!isOriginAllowed(req.headers.origin, allowedOrigins)) {
      ws.close(4403, "forbidden");

      return;
    }

    const client = authenticateClient(ws, req);

    if (!client) {
      ws.close(4401, "unauthorized");

      return;
    }

    broker.join(client);
    attachHandlers(ws, client, broker, heartbeatInterval);
  });

  return wss;
}

function authenticateClient(
  ws: WebSocket,
  req: IncomingMessage,
): Client | null {
  const url = new URL(req.url ?? "", "http://localhost");
  const token = url.searchParams.get("token") ?? undefined;
  const claims = verifyToken(token);

  if (!claims) {
    return null;
  }

  return {
    id: createClientId(),
    ws,
    role: claims.role,
    session: claims.session,
  };
}

function attachHandlers(
  ws: WebSocket,
  client: Client,
  broker: Broker,
  heartbeatInterval: number,
): void {
  let alive = true;

  ws.on("pong", () => {
    alive = true;
  });

  const heartbeat = setInterval(() => {
    if (
      ws.readyState === WebSocket.CLOSED ||
      ws.readyState === WebSocket.CLOSING
    ) {
      clearInterval(heartbeat);

      return;
    }
    if (!alive) {
      ws.terminate();
      clearInterval(heartbeat);

      return;
    }
    alive = false;
    ws.ping();
  }, heartbeatInterval);

  ws.on("message", (raw) => {
    let message: InboundMessage | null = null;

    try {
      message = JSON.parse(raw.toString());
    } catch (error) {
      console.warn("invalid_json", error);

      return;
    }

    if (!message || typeof message !== "object" || !("kind" in message)) {
      return;
    }

    switch (message.kind) {
      case "cmd":
        if (client.role !== "host") {
          return;
        }
        broker.handleCommand(client, message as CommandMessage);
        break;
      case "ack":
        broker.handleAck(client, message as AckMessage);
        break;
      case "state":
        broker.handleState(client, message as StateMessage);
        break;
      default:
        break;
    }
  });

  ws.on("close", () => {
    clearInterval(heartbeat);
    broker.leave(client);
  });
}
