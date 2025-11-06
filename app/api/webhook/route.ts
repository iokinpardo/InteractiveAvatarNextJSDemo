import { NextResponse } from "next/server";

import { addWebhookMessage } from "./eventHub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse webhook payload", error);

    return NextResponse.json(
      { error: "Invalid JSON payload" },
      { status: 400 },
    );
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "Payload must be an object" },
      { status: 400 },
    );
  }

  const { message, botId } = payload as {
    message?: unknown;
    botId?: unknown;
  };

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "`message` is required and must be a non-empty string" },
      { status: 400 },
    );
  }

  if (botId != null && typeof botId !== "string") {
    return NextResponse.json(
      { error: "`botId` must be a string when provided" },
      { status: 400 },
    );
  }

  const webhookMessage = {
    id: crypto.randomUUID(),
    message: message.trim(),
    botId: botId ?? null,
    receivedAt: Date.now(),
  };

  addWebhookMessage(webhookMessage);

  return NextResponse.json({ ok: true });
}
