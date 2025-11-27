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

				// Stop the current session FIRST, before setting pending config
				// This prevents the useEffect from firing prematurely
				if (
					sessionState === StreamingAvatarSessionState.CONNECTED ||
					sessionState === StreamingAvatarSessionState.CONNECTING
				) {
					console.log("Stopping current session for reconfiguration");
					await stopAvatar();
					
					// Wait a bit for state to settle after stopAvatar
					await new Promise((resolve) => setTimeout(resolve, 300));
				}

				// Now set the pending config - this will trigger startSession via useEffect
				// but only after stopAvatar has completed
				setPendingConfigUpdate(config);

				// No need to mark as consumed - configs expire automatically via TTL

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
	}, [customSessionId, sessionState, setPendingConfigUpdate, stopAvatar]);

	// Check for pending config on mount or when session becomes inactive
	// Only check when session is INACTIVE and there's no pending config already
	useEffect(() => {
		if (!customSessionId || customSessionId.trim().length === 0) {
			return;
		}

		// Only check when session is inactive (not connecting or connected)
		// This prevents checking while initial session is still starting
		if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
			return;
		}

		// If there's already a pending config, don't fetch again
		if (pendingConfigUpdate) {
			return;
		}

		// Check for pending config when session is inactive
		const checkPendingConfig = async () => {
			try {
				const configResponse = await fetch(
					`/api/avatar/get-pending-config?customSessionId=${encodeURIComponent(
						customSessionId.trim(),
					)}`,
				);

				if (!configResponse.ok) {
					console.error("Failed to fetch pending configuration");
					return;
				}

				const configData = (await configResponse.json()) as {
					config: SessionConfigUpdate | null;
				};

				if (configData.config) {
					console.log(
						"Found pending configuration on session start:",
						configData.config,
					);
					// Set pending config - this will trigger startSession via sessionInputsSignature
					// But only after the current effect cycle completes, ensuring sessionState is INACTIVE
					setPendingConfigUpdate(configData.config);
					// No need to mark as consumed - configs expire automatically via TTL
				}
			} catch (error) {
				console.error("Error checking for pending config:", error);
			}
		};

		checkPendingConfig();
	}, [
		customSessionId,
		sessionState,
		pendingConfigUpdate,
		setPendingConfigUpdate,
	]);
};

