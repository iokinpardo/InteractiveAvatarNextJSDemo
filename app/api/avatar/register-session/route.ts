import { NextResponse } from "next/server";

import {
  registerSessionMapping,
  hasSessionMapping,
  getHeyGenSessionId,
  unregisterSessionMapping,
} from "@/app/lib/sessionMapping";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

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
          error: "`customSessionId` is required and must be a non-empty string",
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
          error: "`heygenSessionId` is required and must be a non-empty string",
        },
        { status: 400 },
      );
    }

    // Check if mapping already exists
    const trimmedCustomId = customSessionId.trim();
    const trimmedHeyGenId = heygenSessionId.trim();

    if (await hasSessionMapping(trimmedCustomId)) {
      // Get existing mapping to check if it's the same
      // Since hasSessionMapping confirmed a mapping exists, getHeyGenSessionId will return the mapped value
      const existingHeyGenId = await getHeyGenSessionId(trimmedCustomId);

      if (existingHeyGenId === trimmedHeyGenId) {
        // Same mapping - idempotent, return success
        return NextResponse.json(
          {
            ok: true,
            customSessionId: trimmedCustomId,
            heygenSessionId: trimmedHeyGenId,
            message: "Session mapping already exists and matches",
          },
          { status: 200 },
        );
      } else {
        // Different mapping - close the old session before registering the new one
        console.log(
          `Session mapping exists with different HeyGen ID. Closing old session: ${existingHeyGenId}`,
        );

        if (HEYGEN_API_KEY) {
          try {
            const baseApiUrl =
              process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";
            const url = `${baseApiUrl}/v1/streaming.stop`;

            const response = await fetch(url, {
              method: "POST",
              headers: {
                "x-api-key": HEYGEN_API_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ session_id: existingHeyGenId }),
            });

            if (response.ok) {
              console.log(
                `Successfully closed old HeyGen session: ${existingHeyGenId}`,
              );
            } else {
              const errorText = await response.text();

              console.warn(
                `Failed to close old HeyGen session ${existingHeyGenId}:`,
                response.status,
                errorText,
              );
            }
          } catch (error) {
            console.error(
              `Error closing old HeyGen session ${existingHeyGenId}:`,
              error,
            );
          }
        } else {
          console.warn(
            "HEYGEN_API_KEY not available, cannot close old session",
          );
        }

        // Unregister the old mapping regardless of whether we successfully closed the session
        // This allows the new mapping to be registered
        await unregisterSessionMapping(trimmedCustomId);

        // Continue with registering the new mapping
        // Note: We proceed even if closing the old session failed, as the old session
        // may have already been closed or may not exist anymore
      }
    }

    await registerSessionMapping(trimmedCustomId, trimmedHeyGenId);

    return NextResponse.json(
      {
        ok: true,
        customSessionId: trimmedCustomId,
        heygenSessionId: trimmedHeyGenId,
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
