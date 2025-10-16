import http from "http";
import { randomUUID } from "crypto";

import express from "express";
import next from "next";

import { Broker } from "./broker";
import { signToken } from "./auth";
import { initWebSocketServer } from "./ws";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const ackTimeoutMs = parseNumber(process.env.ACK_TIMEOUT_MS, 5000);
const ackMaxRetries = parseNumber(process.env.ACK_MAX_RETRIES, 3);
const maxQueueSize = parseNumber(process.env.COMMAND_QUEUE_SIZE, 50);

const broker = new Broker({
  ackTimeoutMs,
  ackMaxRetries,
  maxQueueSize,
});

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildUrl(
  base: string,
  path: string,
  params: Record<string, string>,
): string {
  const url = new URL(path, base);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url.toString();
}

async function bootstrap(): Promise<void> {
  const nextApp = next({ dev });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  const app = express();

  app.use(express.json({ limit: "256kb" }));

  app.post("/session", (req, res) => {
    const session = randomUUID();
    const wsBase = requireEnv("WS_PUBLIC_URL");
    const publicBase = requireEnv("PUBLIC_APP_URL");

    const avatarToken = signToken({ role: "avatar", session });
    const hostToken = signToken({ role: "host", session });

    const wsAvatar = `${wsBase}?token=${encodeURIComponent(avatarToken)}`;
    const wsHost = `${wsBase}?token=${encodeURIComponent(hostToken)}`;

    const avatarUrl = buildUrl(publicBase, "/avatar", {
      session,
      wss: wsAvatar,
    });
    const hostUrl = buildUrl(publicBase, "/host", {
      session,
      wss: wsHost,
    });

    res.json({
      session,
      ws_avatar: wsAvatar,
      ws_host: wsHost,
      avatar_page: avatarUrl,
      host_panel: hostUrl,
    });
  });

  app.all("*", (req, res) => handle(req, res));

  const server = http.createServer(app);

  initWebSocketServer(server, { broker });

  server.listen(port, () => {
    console.log(`Server ready on http://localhost:${port}`);
  });
}

void bootstrap();
