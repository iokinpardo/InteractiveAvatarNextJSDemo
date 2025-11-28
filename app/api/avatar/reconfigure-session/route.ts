import { NextResponse } from "next/server";
import {
	getHeyGenSessionId,
	unregisterSessionMapping,
} from "@/app/lib/sessionMapping";
import type { SessionConfigUpdate } from "@/app/lib/sessionConfig";
import { sessionEventEmitter } from "@/app/lib/sessionEventEmitter";

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

		const { sessionId, config } = payload as {
			sessionId?: unknown;
			config?: unknown;
		};

		if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
			return NextResponse.json(
				{
					error: "`sessionId` is required and must be a non-empty string",
				},
				{ status: 400 },
			);
		}

		// Validate config if provided
		if (config !== undefined && (typeof config !== "object" || config === null)) {
			return NextResponse.json(
				{ error: "`config` must be an object if provided" },
				{ status: 400 },
			);
		}

		const trimmedSessionId = sessionId.trim();
		const configUpdate = (config ?? {}) as SessionConfigUpdate;

		// Get HeyGen session ID to close the current session
		const heygenSessionId = await getHeyGenSessionId(trimmedSessionId);

		if (!heygenSessionId) {
			return NextResponse.json(
				{
					error:
						"Session not found. The session may not be registered or may have expired.",
				},
				{ status: 404 },
			);
		}

		// Close the current HeyGen session
		const baseApiUrl =
			process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";

		const requestBody = {
			session_id: heygenSessionId,
		};

		const url = `${baseApiUrl}/v1/streaming.stop`;

		console.log("Closing session for reconfiguration:", {
			url,
			customSessionId: trimmedSessionId,
			heygenSessionId,
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
				"HeyGen API error when closing session:",
				response.status,
				response.statusText,
				errorText,
			);

			// Continue anyway - the session may have already been closed
			// or the client may have disconnected
		}

		// Unregister the old mapping to allow the new session to register cleanly
		// This prevents the register-session endpoint from having to close an already-closed session
		await unregisterSessionMapping(trimmedSessionId);

		// Emit SSE event to notify connected clients with the config included
		sessionEventEmitter.emit(trimmedSessionId, {
			type: "config-update",
			customSessionId: trimmedSessionId,
			config: configUpdate,
		});

		console.log(
			`Session reconfiguration initiated for ${trimmedSessionId}`,
			configUpdate,
		);

		return NextResponse.json(
			{
				ok: true,
				sessionId: trimmedSessionId,
				message: "Session reconfiguration initiated",
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error reconfiguring session:", error);

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

