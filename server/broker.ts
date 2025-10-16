import type { WebSocket } from "ws";
import type {
  AckMessage,
  Client,
  CommandMessage,
  PendingCommand,
  StateMessage,
} from "./types";

import { randomUUID } from "crypto";

interface BrokerOptions {
  ackTimeoutMs?: number;
  ackMaxRetries?: number;
  maxQueueSize?: number;
}

const DEFAULT_ACK_TIMEOUT = 5000;
const DEFAULT_ACK_RETRIES = 3;
const DEFAULT_QUEUE_SIZE = 50;

function safeSend(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(typeof payload === "string" ? payload : JSON.stringify(payload));
  }
}

export class Broker {
  private readonly rooms = new Map<string, Set<Client>>();
  private readonly pending = new Map<string, PendingCommand>();
  private readonly queues = new Map<string, CommandMessage[]>();

  private readonly ackTimeoutMs: number;
  private readonly ackMaxRetries: number;
  private readonly maxQueueSize: number;

  constructor(options: BrokerOptions = {}) {
    this.ackTimeoutMs = options.ackTimeoutMs ?? DEFAULT_ACK_TIMEOUT;
    this.ackMaxRetries = options.ackMaxRetries ?? DEFAULT_ACK_RETRIES;
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_QUEUE_SIZE;
  }

  join(client: Client): void {
    if (!this.rooms.has(client.session)) {
      this.rooms.set(client.session, new Set());
    }
    this.rooms.get(client.session)!.add(client);

    if (client.role === "avatar") {
      this.flushQueue(client.session);
    }
  }

  leave(client: Client): void {
    const room = this.rooms.get(client.session);

    if (room) {
      room.delete(client);
      if (room.size === 0) {
        this.rooms.delete(client.session);
      }
    }

    // Cancel pending commands awaiting ACKs from this host
    this.pending.forEach((pending, id) => {
      if (pending.host === client.ws) {
        this.clearPending(id, false, "host_disconnected");
      }
    });
  }

  handleCommand(client: Client, message: CommandMessage): void {
    const normalized: CommandMessage = {
      ...message,
      session: client.session,
      id: message.id || randomUUID(),
    };

    const pending: PendingCommand = {
      message: normalized,
      host: client.ws,
      session: client.session,
      attempts: 0,
      timeout: null,
    };

    this.pending.set(normalized.id, pending);

    if (!this.dispatchToAvatars(pending)) {
      this.enqueue(normalized.session, normalized);
      this.log("queue", normalized.session, normalized.id, {
        action: normalized.action,
        reason: "no_avatar_connected",
      });
    }
  }

  handleAck(client: Client, ack: AckMessage): void {
    if (client.role !== "avatar") return;
    const pending = this.pending.get(ack.id);

    if (!pending) return;

    this.clearTimeout(pending);
    this.pending.delete(ack.id);

    const payload: AckMessage = {
      v: ack.v ?? pending.message.v,
      kind: "ack",
      id: ack.id,
      ok: ack.ok,
      ts: ack.ts ?? Date.now(),
      error: ack.error,
    };

    safeSend(pending.host, payload);
    this.log("ack", pending.session, ack.id, {
      ok: ack.ok,
      attempts: pending.attempts,
    });
  }

  handleState(client: Client, state: StateMessage): void {
    if (client.role !== "avatar") return;
    const room = this.rooms.get(client.session);

    if (!room) return;

    const payload: StateMessage = {
      ...state,
      session: client.session,
      ts: state.ts ?? Date.now(),
    };

    room.forEach((target) => {
      if (target.role === "host") {
        safeSend(target.ws, payload);
      }
    });
    this.log("state", client.session, state.scene ?? "unknown", {});
  }

  private dispatchToAvatars(pending: PendingCommand): boolean {
    const room = this.rooms.get(pending.session);

    if (!room) return false;

    const avatars = Array.from(room).filter((c) => c.role === "avatar");

    if (avatars.length === 0) {
      return false;
    }

    pending.attempts += 1;
    const serialized = JSON.stringify(pending.message);

    for (const avatar of avatars) {
      safeSend(avatar.ws, serialized);
    }
    this.startAckTimer(pending);
    this.log("dispatch", pending.session, pending.message.id, {
      action: pending.message.action,
      attempts: pending.attempts,
      targets: avatars.length,
    });

    return true;
  }

  private enqueue(session: string, message: CommandMessage): void {
    if (!this.queues.has(session)) {
      this.queues.set(session, []);
    }
    const queue = this.queues.get(session)!;

    queue.push(message);
    if (queue.length > this.maxQueueSize) {
      queue.splice(0, queue.length - this.maxQueueSize);
    }
  }

  private flushQueue(session: string): void {
    const queue = this.queues.get(session);

    if (!queue || queue.length === 0) {
      return;
    }

    this.log("flush", session, String(queue.length), {});
    while (queue.length > 0) {
      const message = queue.shift()!;
      const pending = this.pending.get(message.id);

      if (!pending) {
        continue;
      }
      this.dispatchToAvatars(pending);
    }
  }

  private startAckTimer(pending: PendingCommand): void {
    this.clearTimeout(pending);
    pending.timeout = setTimeout(() => {
      this.handleAckTimeout(pending.message.id);
    }, this.ackTimeoutMs);
  }

  private handleAckTimeout(id: string): void {
    const pending = this.pending.get(id);

    if (!pending) return;

    if (pending.attempts >= this.ackMaxRetries) {
      this.log("ack_timeout", pending.session, id, {
        attempts: pending.attempts,
      });
      this.clearPending(id, false, "ack_timeout");

      return;
    }

    this.log("ack_retry", pending.session, id, {
      attempts: pending.attempts,
    });
    if (!this.dispatchToAvatars(pending)) {
      this.enqueue(pending.session, pending.message);
    }
  }

  private clearPending(id: string, ok: boolean, error?: string): void {
    const pending = this.pending.get(id);

    if (!pending) return;
    this.clearTimeout(pending);
    this.pending.delete(id);

    const ack: AckMessage = {
      v: pending.message.v,
      kind: "ack",
      id,
      ok,
      ts: Date.now(),
      error,
    };

    safeSend(pending.host, ack);
  }

  private clearTimeout(pending: PendingCommand): void {
    if (pending.timeout) {
      clearTimeout(pending.timeout);
      pending.timeout = null;
    }
  }

  private log(
    event: string,
    session: string,
    id: string,
    extra: Record<string, unknown>,
  ): void {
    const payload = {
      event,
      session,
      id,
      ...extra,
      ts: Date.now(),
    };

    console.log(JSON.stringify(payload));
  }
}

export function createClientId(): string {
  return randomUUID();
}
