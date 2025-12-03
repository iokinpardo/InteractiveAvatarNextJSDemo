import type { SessionConfigUpdate } from "@/app/lib/sessionConfig";

import { useEffect, useRef } from "react";

import { useStreamingAvatarContext } from "./context";
import { StreamingAvatarSessionState } from "./context";
import { useStreamingAvatarSession } from "./useStreamingAvatarSession";

export const useSessionReconfiguration = () => {
  const {
    customSessionId,
    sessionState,
    setPendingConfigUpdate,
    pendingConfigUpdate,
    setIsExplicitlyClosed,
  } = useStreamingAvatarContext();
  const { stopAvatar, sessionId: heygenSessionId } =
    useStreamingAvatarSession();

  const eventSourceRef = useRef<EventSource | null>(null);
  const isReconnectingRef = useRef(false);
  const pendingOperationIdRef = useRef<string | null>(null);
  const pendingCloseOperationIdRef = useRef<string | null>(null);
  const sessionStateRef = useRef<StreamingAvatarSessionState>(sessionState);

  // Keep sessionStateRef in sync with sessionState
  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

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

    eventSource.addEventListener("session-close", async (event) => {
      console.log("Received session-close event", event);

      // Parse event data to get operationId if present
      let operationId: string | undefined;

      try {
        const eventData = JSON.parse(event.data) as {
          type: string;
          customSessionId: string;
          operationId?: string;
        };

        operationId = eventData.operationId;

        // Store operationId for confirmation after session is closed
        if (operationId) {
          pendingCloseOperationIdRef.current = operationId;
          console.log(
            "Stored operationId for session close confirmation:",
            operationId,
          );
        }
      } catch (parseError) {
        console.error("Failed to parse session-close event data:", parseError);
      }

      // Set flag to prevent auto-restart
      setIsExplicitlyClosed(true);

      // Close the session when we receive the session-close event
      // Use ref to get current state (avoid stale closure)
      const currentState = sessionStateRef.current;
      if (
        currentState === StreamingAvatarSessionState.CONNECTED ||
        currentState === StreamingAvatarSessionState.CONNECTING
      ) {
        console.log("Closing session due to session-close event");
        await stopAvatar();
      } else {
        console.log(
          `Session already closed or inactive (state: ${currentState}), confirming immediately`,
        );
        // If already inactive, confirm immediately
        if (operationId && currentState === StreamingAvatarSessionState.INACTIVE) {
          try {
            const response = await fetch("/api/avatar/confirm-operation", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId: customSessionId.trim(),
                operationId,
                status: "success",
              }),
            });

            if (response.ok) {
              console.log(
                `Confirmed session close for operation ${operationId} (already inactive)`,
              );
              pendingCloseOperationIdRef.current = null;
            }
          } catch (error) {
            console.error(
              `Error confirming session close for operation ${operationId}:`,
              error,
            );
          }
        }
      }
    });

    eventSource.addEventListener("config-update", async (event) => {
      const configUpdateStartTime = Date.now();
      console.log("Received config-update event", event);

      if (isReconnectingRef.current) {
        console.log("Already reconnecting, ignoring config-update event");

        return;
      }

      try {
        isReconnectingRef.current = true;

        // Parse the event data which includes the configuration and operationId
        let config: SessionConfigUpdate;
        let operationId: string | undefined;

        try {
          const eventData = JSON.parse(event.data) as {
            type: string;
            customSessionId: string;
            config: SessionConfigUpdate;
            operationId?: string;
          };

          if (!eventData.config) {
            console.warn("No configuration in event data");
            isReconnectingRef.current = false;

            return;
          }

          config = eventData.config;
          operationId = eventData.operationId;

          // Store operationId for confirmation after reconnection
          if (operationId) {
            pendingOperationIdRef.current = operationId;
            console.log("Stored operationId for confirmation:", operationId);
          }
        } catch (parseError) {
          console.error("Failed to parse event data:", parseError);
          isReconnectingRef.current = false;

          return;
        }

        console.log("Received configuration from SSE event:", {
          config,
          operationId,
        });

        // Reset explicitly closed flag to allow restart with new config
        setIsExplicitlyClosed(false);

        // Set the pending config FIRST, so it's available when we restart
        setPendingConfigUpdate(config);

        // Stop the current session - this will trigger a reconnection
        // The InteractiveAvatar component will detect the pending config
        // and restart with the new configuration
        // Use ref to get current state (avoid stale closure)
        const currentState = sessionStateRef.current;
        if (
          currentState === StreamingAvatarSessionState.CONNECTED ||
          currentState === StreamingAvatarSessionState.CONNECTING
        ) {
          const stopStartTime = Date.now();
          console.log("Stopping current session for reconfiguration");
          await stopAvatar();
          const stopDuration = Date.now() - stopStartTime;
          console.log(
            `[Reconfig] stopAvatar completed in ${stopDuration}ms`,
          );

          // Wait a bit for state to settle after stopAvatar
          // The customSessionId will be restored by the useEffect in InteractiveAvatar
          await new Promise((resolve) => setTimeout(resolve, 300));
          console.log(
            `[Reconfig] Total time from config-update event to stop complete: ${Date.now() - configUpdateStartTime}ms`,
          );
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
  }, [
    customSessionId,
    sessionState,
    setPendingConfigUpdate,
    setIsExplicitlyClosed,
    stopAvatar,
  ]);

  // Confirm reconfiguration when session becomes CONNECTED after reconfiguration
  useEffect(() => {
    // Check if we transitioned to CONNECTED and have a pending operationId
    if (
      sessionState === StreamingAvatarSessionState.CONNECTED &&
      pendingOperationIdRef.current &&
      customSessionId &&
      heygenSessionId
    ) {
      // Wait a bit to ensure the mapping is registered
      // The mapping registration happens in InteractiveAvatar's useEffect
      const confirmReconfiguration = async () => {
        const operationId = pendingOperationIdRef.current;
        const connectedTime = Date.now();

        if (!operationId) {
          return;
        }

        console.log(
          `[Reconfig] Session reached CONNECTED state, waiting for mapping registration...`,
        );

        // Wait a bit more to ensure mapping registration is complete
        // The mapping registration happens asynchronously after CONNECTED state
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const mappingWaitDuration = Date.now() - connectedTime;
        console.log(
          `[Reconfig] Mapping wait completed (${mappingWaitDuration}ms after CONNECTED), confirming operation ${operationId}`,
        );

        try {
          const response = await fetch("/api/avatar/confirm-operation", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: customSessionId.trim(),
              operationId,
              status: "success",
            }),
          });

          if (response.ok) {
            const totalDuration = Date.now() - connectedTime;
            console.log(
              `[Reconfig] Confirmed reconfiguration completion for operation ${operationId} (total: ${totalDuration}ms from CONNECTED)`,
            );
            pendingOperationIdRef.current = null;
          } else {
            const errorText = await response.text();

            console.error(
              `Failed to confirm reconfiguration for operation ${operationId}:`,
              response.status,
              errorText,
            );
          }
        } catch (error) {
          console.error(
            `Error confirming reconfiguration for operation ${operationId}:`,
            error,
          );
        }
      };

      confirmReconfiguration();
    }
  }, [sessionState, customSessionId, heygenSessionId]);

  // Confirm session close when session becomes INACTIVE after receiving session-close event
  useEffect(() => {
    // Check if we're INACTIVE and have a pending close operationId
    if (
      sessionState === StreamingAvatarSessionState.INACTIVE &&
      pendingCloseOperationIdRef.current &&
      customSessionId
    ) {
      const confirmClose = async () => {
        const operationId = pendingCloseOperationIdRef.current;

        if (!operationId) {
          return;
        }

        // Wait a bit to ensure the session is fully closed
        await new Promise((resolve) => setTimeout(resolve, 500));

        try {
          const response = await fetch("/api/avatar/confirm-operation", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: customSessionId.trim(),
              operationId,
              status: "success",
            }),
          });

          if (response.ok) {
            console.log(`Confirmed session close for operation ${operationId}`);
            pendingCloseOperationIdRef.current = null;
          } else {
            const errorText = await response.text();

            console.error(
              `Failed to confirm session close for operation ${operationId}:`,
              response.status,
              errorText,
            );
          }
        } catch (error) {
          console.error(
            `Error confirming session close for operation ${operationId}:`,
            error,
          );
        }
      };

      confirmClose();
    }
  }, [sessionState, customSessionId]);
};
