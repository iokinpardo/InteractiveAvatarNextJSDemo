import type { WebSocket } from "ws";

export type Role = "host" | "avatar";

export interface Client {
  id: string;
  ws: WebSocket;
  role: Role;
  session: string;
}

export interface CommandMessage {
  v: number;
  kind: "cmd";
  id: string;
  session: string;
  action: string;
  payload?: Record<string, unknown>;
  ts: number;
}

export interface AckMessage {
  v?: number;
  kind: "ack";
  id: string;
  ok: boolean;
  ts?: number;
  error?: string;
}

export interface StateMessage {
  v?: number;
  kind: "state";
  session: string;
  scene?: string;
  theme?: string;
  ts: number;
  [key: string]: unknown;
}

export type InboundMessage = CommandMessage | AckMessage | StateMessage;

export interface PendingCommand {
  message: CommandMessage;
  host: WebSocket;
  session: string;
  attempts: number;
  timeout: NodeJS.Timeout | null;
}
