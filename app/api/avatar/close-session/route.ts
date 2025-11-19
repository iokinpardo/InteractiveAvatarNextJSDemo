import { NextResponse } from "next/server";
import {
  getHeyGenSessionId,
  unregisterSessionMapping,
} from "@/app/lib/sessionMapping";

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

    const { sessionId } = payload as {
      sessionId?: unknown;
    };

    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: "`sessionId` is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    // Translate custom sessionId to HeyGen sessionId
    const heygenSessionId = getHeyGenSessionId(sessionId);

    if (!heygenSessionId) {
      return NextResponse.json(
        {
          error:
            "Session not found. The session may not be registered or may have expired.",
        },
        { status: 404 },
      );
    }

    const baseApiUrl =
      process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";

    const requestBody = {
      session_id: heygenSessionId,
    };

    const url = `${baseApiUrl}/v1/streaming.stop`;

    console.log("Closing session via HeyGen API:", {
      url,
      customSessionId: sessionId.trim(),
      heygenSessionId,
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
          error: "Failed to close session via HeyGen API",
          details: errorText,
        },
        { status: response.status },
      );
    }

    // Unregister the mapping after successful closure
    unregisterSessionMapping(sessionId);

    const data = await response.json();

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error("Error closing session:", error);

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
