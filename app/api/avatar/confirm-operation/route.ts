import { NextResponse } from "next/server";

import { sessionConfirmationManager } from "@/app/lib/sessionConfirmation";

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

    const { sessionId, operationId, status, error } = payload as {
      sessionId?: unknown;
      operationId?: unknown;
      status?: unknown;
      error?: unknown;
    };

    if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return NextResponse.json(
        {
          error: "`sessionId` is required and must be a non-empty string",
        },
        { status: 400 },
      );
    }

    if (typeof operationId !== "string" || operationId.trim().length === 0) {
      return NextResponse.json(
        {
          error: "`operationId` is required and must be a non-empty string",
        },
        { status: 400 },
      );
    }

    if (status !== "success" && status !== "error") {
      return NextResponse.json(
        {
          error: "`status` is required and must be either 'success' or 'error'",
        },
        { status: 400 },
      );
    }

    const trimmedSessionId = sessionId.trim();
    const trimmedOperationId = operationId.trim();

    if (status === "success") {
      const confirmed = sessionConfirmationManager.confirm(
        trimmedOperationId,
        trimmedSessionId,
      );

      if (!confirmed) {
        return NextResponse.json(
          {
            error:
              "Operation not found or already confirmed. The operation may have expired or been cancelled.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          message: "Operation confirmed successfully",
        },
        { status: 200 },
      );
    } else {
      // status === "error"
      const errorMessage =
        typeof error === "string" ? error : "Operation failed";

      const rejected = sessionConfirmationManager.reject(
        trimmedOperationId,
        trimmedSessionId,
        errorMessage,
      );

      if (!rejected) {
        return NextResponse.json(
          {
            error:
              "Operation not found or already confirmed. The operation may have expired or been cancelled.",
          },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          message: "Operation rejection recorded",
        },
        { status: 200 },
      );
    }
  } catch (error) {
    console.error("Error confirming operation:", error);

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
