import { useEffect, useRef } from "react";
import { useStreamingAvatarContext } from "./context";
import { StreamingAvatarSessionState } from "./context";
import { useStreamingAvatarSession } from "./useStreamingAvatarSession";
import type { SessionConfigUpdate } from "@/app/lib/sessionConfig";

export const useSessionReconfiguration = () => {
	const {
		customSessionId,
		sessionState,
		setPendingConfigUpdate,
		pendingConfigUpdate,
		setIsExplicitlyClosed,
	} = useStreamingAvatarContext();
	const { stopAvatar } = useStreamingAvatarSession();

	const eventSourceRef = useRef<EventSource | null>(null);
	const isReconnectingRef = useRef(false);

	// Subscribe to SSE events when customSessionId is present
	useEffect(() => {
		if (!customSessionId || customSessionId.trim().length === 0) {
			return;
		}

		const trimmedSessionId = customSessionId.trim();
		const url = `/api/avatar/session-events?customSessionId=${encodeURIComponent(
			trimmedSessionId,
		)}`;

		console.log("Subscribing to session events for:", trimmedSessionId);

		const eventSource = new EventSource(url);
		eventSourceRef.current = eventSource;

		eventSource.addEventListener("connected", (event) => {
			console.log("Connected to session events stream", event);
		});

		eventSource.addEventListener("session-close", (event) => {
			console.log("Received session-close event", event);
			// Set flag to prevent auto-restart
			setIsExplicitlyClosed(true);
		});

		eventSource.addEventListener("config-update", async (event) => {
			console.log("Received config-update event", event);

			if (isReconnectingRef.current) {
				console.log("Already reconnecting, ignoring config-update event");
				return;
			}

			try {
				isReconnectingRef.current = true;

				// Parse the event data which includes the configuration
				let config: SessionConfigUpdate;
				try {
					const eventData = JSON.parse(event.data) as {
						type: string;
						customSessionId: string;
						config: SessionConfigUpdate;
					};

					if (!eventData.config) {
						console.warn("No configuration in event data");
						isReconnectingRef.current = false;
						return;
					}

					config = eventData.config;
				} catch (parseError) {
					console.error("Failed to parse event data:", parseError);
					isReconnectingRef.current = false;
					return;
				}

				console.log("Received configuration from SSE event:", config);

				// Reset explicitly closed flag to allow restart with new config
				setIsExplicitlyClosed(false);

				// Set the pending config FIRST, so it's available when we restart
				setPendingConfigUpdate(config);

				// Stop the current session - this will trigger a reconnection
				// The InteractiveAvatar component will detect the pending config
				// and restart with the new configuration
				if (
					sessionState === StreamingAvatarSessionState.CONNECTED ||
					sessionState === StreamingAvatarSessionState.CONNECTING
				) {
					console.log("Stopping current session for reconfiguration");
					await stopAvatar();
					
					// Wait a bit for state to settle after stopAvatar
					// The customSessionId will be restored by the useEffect in InteractiveAvatar
					await new Promise((resolve) => setTimeout(resolve, 300));
				}

				// Clear the reconnecting flag after a delay
				// to allow the session to restart
				setTimeout(() => {
					isReconnectingRef.current = false;
				}, 2000);
			} catch (error) {
				console.error("Error handling config-update event:", error);
				isReconnectingRef.current = false;
			}
		});

		eventSource.addEventListener("heartbeat", (event) => {
			// Keep connection alive - no action needed
			console.debug("SSE heartbeat received", event);
		});

		eventSource.onerror = (error) => {
			console.error("SSE connection error:", error);
			// EventSource will automatically reconnect
		};

		return () => {
			console.log("Unsubscribing from session events");
			eventSource.close();
			eventSourceRef.current = null;
		};
	}, [customSessionId, sessionState, setPendingConfigUpdate, setIsExplicitlyClosed, stopAvatar]);
};

