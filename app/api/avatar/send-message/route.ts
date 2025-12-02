import { NextResponse } from "next/server";

import { getHeyGenSessionId } from "@/app/lib/sessionMapping";

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

    // Verify that a valid session mapping exists before sending
    // Translate custom sessionId to HeyGen sessionId
    const heygenSessionId = await getHeyGenSessionId(sessionId);

    if (!heygenSessionId) {
      return NextResponse.json(
        {
          error:
            "Session not found. The session may not be registered or may have expired. Please ensure the session is active and connected.",
        },
        { status: 404 },
      );
    }

    const baseApiUrl =
      process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";

    // Map taskType and taskMode to HeyGen API format
    const task_type = taskType === "REPEAT" ? "repeat" : "chat";
    const task_mode = taskMode === "SYNC" ? "sync" : "async";

    const requestBody = {
      session_id: heygenSessionId,
      text: message.trim(),
      task_type,
      task_mode,
    };

    const url = `${baseApiUrl}/v1/streaming.task`;

    console.log("Sending request to HeyGen API:", {
      url,
      customSessionId: sessionId.trim(),
      heygenSessionId,
      task_mode,
      hasApiKey: !!HEYGEN_API_KEY,
    });

    // Note: When task_mode is "sync", HeyGen API responds immediately when
    // speech starts, but includes the speech duration in milliseconds in the response.
    // We wait for that duration before responding to the client to ensure
    // the speech has completed.

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

    // When task_mode is "sync", HeyGen responds immediately when speech starts,
    // but includes the duration of the speech in milliseconds in the response.
    // According to HeyGen API docs: https://docs.heygen.com/reference/send-task
    // The response includes "duration_ms" (float) field indicating how long
    // the avatar speaks for the input text.
    // We need to wait for that duration before responding to the client.
    if (task_mode === "sync") {
      // Extract duration_ms from response (primary field according to HeyGen docs)
      // Also check for nested data.duration_ms as fallback
      const durationMs =
        (data as { duration_ms?: number }).duration_ms ??
        (data as { data?: { duration_ms?: number } }).data?.duration_ms;

      if (typeof durationMs === "number" && durationMs > 0) {
        console.log(
          `Waiting ${durationMs}ms for speech to complete (sync mode)`,
        );
        await new Promise((resolve) => setTimeout(resolve, durationMs));
        console.log("Speech duration elapsed, responding to client");
      } else {
        console.warn(
          "Sync mode enabled but duration_ms not found in HeyGen response:",
          JSON.stringify(data),
        );
      }
    }

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
