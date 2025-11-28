import { NextRequest } from "next/server";
import { sessionEventEmitter } from "@/app/lib/sessionEventEmitter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const customSessionId = searchParams.get("customSessionId");

	if (!customSessionId || customSessionId.trim().length === 0) {
		return new Response(
			JSON.stringify({ error: "customSessionId query parameter is required" }),
			{
				status: 400,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	const trimmedSessionId = customSessionId.trim();

	// Create a ReadableStream for SSE
	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();

			// Send initial connection message
			const sendEvent = (event: string, data: string) => {
				const message = `event: ${event}\ndata: ${data}\n\n`;
				controller.enqueue(encoder.encode(message));
			};

			sendEvent("connected", JSON.stringify({ customSessionId: trimmedSessionId }));

			// Subscribe to events for this session
			const unsubscribe = sessionEventEmitter.subscribe(
				trimmedSessionId,
				(event) => {
					sendEvent(event.type, JSON.stringify(event));
				},
			);

			// Send heartbeat every 30 seconds to keep connection alive
			const heartbeatInterval = setInterval(() => {
				try {
					sendEvent("heartbeat", JSON.stringify({ timestamp: Date.now() }));
				} catch (error) {
					// Connection may be closed
					clearInterval(heartbeatInterval);
					unsubscribe();
				}
			}, 30000);

			// Cleanup on close
			request.signal.addEventListener("abort", () => {
				clearInterval(heartbeatInterval);
				unsubscribe();
				try {
					controller.close();
				} catch (error) {
					// Stream may already be closed
				}
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no", // Disable buffering in nginx
		},
	});
}

