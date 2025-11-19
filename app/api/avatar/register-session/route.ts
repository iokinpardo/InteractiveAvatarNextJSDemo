import { NextResponse } from "next/server";
import {
  registerSessionMapping,
  hasSessionMapping,
} from "@/app/lib/sessionMapping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
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

    const { customSessionId, heygenSessionId } = payload as {
      customSessionId?: unknown;
      heygenSessionId?: unknown;
    };

    if (
      typeof customSessionId !== "string" ||
      customSessionId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "`customSessionId` is required and must be a non-empty string",
        },
        { status: 400 },
      );
    }

    if (
      typeof heygenSessionId !== "string" ||
      heygenSessionId.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "`heygenSessionId` is required and must be a non-empty string",
        },
        { status: 400 },
      );
    }

    // Check if mapping already exists
    if (hasSessionMapping(customSessionId)) {
      return NextResponse.json(
        {
          error: "Session mapping already exists",
          customSessionId: customSessionId.trim(),
        },
        { status: 409 },
      );
    }

    registerSessionMapping(customSessionId, heygenSessionId);

    return NextResponse.json(
      {
        ok: true,
        customSessionId: customSessionId.trim(),
        heygenSessionId: heygenSessionId.trim(),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error registering session mapping:", error);

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

