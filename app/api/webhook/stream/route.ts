import {
  getBufferedWebhookMessages,
  subscribeToWebhookMessages,
  type WebhookMessagePayload,
} from "../eventHub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

const formatEvent = (payload: WebhookMessagePayload) => {
  const serialized = JSON.stringify(payload);

  return (
    `id: ${payload.id}\n` +
    "event: webhook-message\n" +
    `data: ${serialized}\n\n`
  );
};

export async function GET(request: Request) {
  const { signal } = request;

  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sendPayload = (payload: WebhookMessagePayload) => {
        controller.enqueue(encoder.encode(formatEvent(payload)));
      };

      getBufferedWebhookMessages().forEach(sendPayload);

      const unsubscribe = subscribeToWebhookMessages(sendPayload);
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`:heartbeat ${Date.now()}\n\n`));
      }, 15000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      signal.addEventListener("abort", () => {
        cleanup?.();
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
