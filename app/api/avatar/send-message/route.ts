import { NextResponse } from "next/server";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: "API key is missing from .env" },
        { status: 500 },
      );
    }

    let payload: unknown;

    try {
      payload = await request.json();
    } catch (error) {
      console.error("Failed to parse request payload", error);

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

    const { sessionId, message, taskType, taskMode } = payload as {
      sessionId?: unknown;
      message?: unknown;
      taskType?: unknown;
      taskMode?: unknown;
    };

    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: "`sessionId` is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "`message` is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const baseApiUrl =
      process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";

    // Map taskType and taskMode to HeyGen API format
    const task_type = taskType === "REPEAT" ? "repeat" : "chat";
    const task_mode = taskMode === "SYNC" ? "sync" : "async";

    const requestBody = {
      session_id: sessionId.trim(),
      text: message.trim(),
      task_type,
      task_mode,
    };

    const url = `${baseApiUrl}/v1/streaming.task`;

    console.log("Sending request to HeyGen API:", {
      url,
      sessionId: sessionId.trim(),
      hasApiKey: !!HEYGEN_API_KEY,
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "HeyGen API error:",
        response.status,
        response.statusText,
        errorText,
      );

      return NextResponse.json(
        {
          error: "Failed to send message to HeyGen API",
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error("Error sending message to avatar:", error);

    return NextResponse.json(
      {
        error: "Internal server error",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    );
  }
}
