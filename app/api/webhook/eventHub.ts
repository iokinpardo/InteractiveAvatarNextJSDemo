import { EventEmitter } from "events";

export type WebhookMessagePayload = {
  id: string;
  message: string;
  botId?: string | null;
  receivedAt: number;
};

const EMITTER_KEY = Symbol.for("interactive-avatar.webhook.emitter");
const BUFFER_KEY = Symbol.for("interactive-avatar.webhook.buffer");
const MAX_BUFFER_LENGTH = 50;

type GlobalWithWebhookHub = typeof globalThis & {
  [EMITTER_KEY]?: EventEmitter;
  [BUFFER_KEY]?: WebhookMessagePayload[];
};

const globalScope = globalThis as GlobalWithWebhookHub;

if (!globalScope[EMITTER_KEY]) {
  globalScope[EMITTER_KEY] = new EventEmitter();
  globalScope[EMITTER_KEY].setMaxListeners(100);
}

if (!globalScope[BUFFER_KEY]) {
  globalScope[BUFFER_KEY] = [];
}

const emitter = globalScope[EMITTER_KEY]!;
const buffer = globalScope[BUFFER_KEY]!;

export const addWebhookMessage = (payload: WebhookMessagePayload) => {
  buffer.push(payload);

  if (buffer.length > MAX_BUFFER_LENGTH) {
    buffer.splice(0, buffer.length - MAX_BUFFER_LENGTH);
  }

  emitter.emit("message", payload);
};

export const getBufferedWebhookMessages = () => [...buffer];

export const subscribeToWebhookMessages = (
  listener: (payload: WebhookMessagePayload) => void,
) => {
  emitter.on("message", listener);

  return () => {
    emitter.off("message", listener);
  };
};
