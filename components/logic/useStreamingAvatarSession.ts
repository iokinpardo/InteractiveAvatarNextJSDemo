import StreamingAvatar, {
  ConnectionQuality,
  StartAvatarRequest,
  StreamingEvents,
  type EventHandler,
} from "@heygen/streaming-avatar";
import { useCallback, useEffect, useRef } from "react";

import {
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./context";
import { useVoiceChat } from "./useVoiceChat";
import { useMessageHistory } from "./useMessageHistory";

export const useStreamingAvatarSession = () => {
  const {
    avatarRef,
    basePath,
    sessionState,
    setSessionState,
    stream,
    setStream,
    sessionId,
    setSessionId,
    setIsListening,
    setIsUserTalking,
    setIsAvatarTalking,
    setConnectionQuality,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    clearMessages,
  } = useStreamingAvatarContext();
  const { stopVoiceChat } = useVoiceChat();

  useMessageHistory();

  const listenersRef = useRef<Array<[StreamingEvents, EventHandler]>>([]);

  const init = useCallback(
    (token: string) => {
      avatarRef.current = new StreamingAvatar({
        token,
        basePath: basePath,
      });

      return avatarRef.current;
    },
    [basePath, avatarRef],
  );

  const handleStream = useCallback(
    ({ detail }: { detail: MediaStream }) => {
      setStream(detail);
      setSessionState(StreamingAvatarSessionState.CONNECTED);
    },
    [setSessionState, setStream],
  );

  const handleStreamReady = useCallback(
    (event: {
      detail: MediaStream | { session_id?: string; stream?: MediaStream };
    }) => {
      // Try to get session_id from STREAM_READY event detail if available
      if (
        event.detail &&
        typeof event.detail === "object" &&
        "session_id" in event.detail
      ) {
        const detail = event.detail as {
          session_id?: string;
          stream?: MediaStream;
        };

        if (detail.session_id) {
          setSessionId(detail.session_id);
        }

        // If there's a stream in the detail, use it
        if (detail.stream) {
          setStream(detail.stream);
          setSessionState(StreamingAvatarSessionState.CONNECTED);
        }
      } else if (event.detail instanceof MediaStream) {
        // Standard case: detail is MediaStream
        handleStream(event as { detail: MediaStream });
      }
    },
    [handleStream, setSessionId, setStream, setSessionState],
  );

  const handleConnectionQualityChange = useCallback(
    ({ detail }: { detail: ConnectionQuality }) => {
      setConnectionQuality(detail);
    },
    [setConnectionQuality],
  );

  const handleUserStart = useCallback(() => {
    setIsUserTalking(true);
  }, [setIsUserTalking]);

  const handleUserStop = useCallback(() => {
    setIsUserTalking(false);
  }, [setIsUserTalking]);

  const handleAvatarStartTalking = useCallback(() => {
    setIsAvatarTalking(true);
  }, [setIsAvatarTalking]);

  const handleAvatarStopTalking = useCallback(() => {
    setIsAvatarTalking(false);
  }, [setIsAvatarTalking]);

  const detachListeners = useCallback(() => {
    const avatar = avatarRef.current;

    if (!avatar || listenersRef.current.length === 0) {
      return;
    }

    listenersRef.current.forEach(([event, handler]) => {
      avatar.off(event, handler);
    });

    listenersRef.current = [] as Array<[StreamingEvents, EventHandler]>;
  }, [avatarRef]);

  const stop = useCallback(async () => {
    // Set state to DISCONNECTING before cleaning up resources
    setSessionState(StreamingAvatarSessionState.DISCONNECTING);
    detachListeners();
    clearMessages();
    stopVoiceChat();
    setIsListening(false);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setStream(null);
    setSessionId(null);
    await avatarRef.current?.stopAvatar();
    setSessionState(StreamingAvatarSessionState.INACTIVE);
  }, [
    detachListeners,
    avatarRef,
    setIsListening,
    stopVoiceChat,
    clearMessages,
    setIsUserTalking,
    setIsAvatarTalking,
    setStream,
    setSessionId,
    setSessionState,
  ]);

  const handleStreamDisconnected = useCallback(() => {
    stop();
  }, [stop]);

  // Detect when stream is disconnected externally (e.g., via API call)
  useEffect(() => {
    if (!stream || sessionState === StreamingAvatarSessionState.INACTIVE) {
      return;
    }

    // Store stream reference to avoid stale closures
    const currentStream = stream;
    let isCleanedUp = false;

    const checkStreamActive = () => {
      if (isCleanedUp) {
        return;
      }

      // Check if stream is still active
      if (currentStream && !currentStream.active) {
        console.log("Stream is no longer active, stopping session");
        isCleanedUp = true;
        stop();
        return;
      }

      // Check if any tracks have ended
      try {
        const endedTracks = currentStream
          .getTracks()
          .filter((track) => track.readyState === "ended");
        if (endedTracks.length > 0) {
          console.log("Stream tracks have ended, stopping session");
          isCleanedUp = true;
          stop();
          return;
        }
      } catch (error) {
        // Stream may have been cleaned up
        console.log("Error checking stream tracks, stopping session", error);
        isCleanedUp = true;
        stop();
      }
    };

    // Set up listeners for track ended events
    const handleTrackEnded = () => {
      if (isCleanedUp) {
        return;
      }
      console.log("Stream track ended, stopping session");
      isCleanedUp = true;
      stop();
    };

    const tracks = currentStream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener("ended", handleTrackEnded);
    });

    // Periodic check for stream state (fallback)
    const intervalId = setInterval(checkStreamActive, 1000);

    return () => {
      isCleanedUp = true;
      tracks.forEach((track) => {
        track.removeEventListener("ended", handleTrackEnded);
      });
      clearInterval(intervalId);
    };
  }, [stream, sessionState, stop]);

  const attachListeners = useCallback(() => {
    const avatar = avatarRef.current;

    if (!avatar) {
      return;
    }

    const listeners: Array<[StreamingEvents, EventHandler]> = [
      [StreamingEvents.STREAM_READY, handleStreamReady],
      [StreamingEvents.STREAM_DISCONNECTED, handleStreamDisconnected],
      [
        StreamingEvents.CONNECTION_QUALITY_CHANGED,
        handleConnectionQualityChange,
      ],
      [StreamingEvents.USER_START, handleUserStart],
      [StreamingEvents.USER_STOP, handleUserStop],
      [StreamingEvents.AVATAR_START_TALKING, handleAvatarStartTalking],
      [StreamingEvents.AVATAR_STOP_TALKING, handleAvatarStopTalking],
      [StreamingEvents.USER_TALKING_MESSAGE, handleUserTalkingMessage],
      [StreamingEvents.AVATAR_TALKING_MESSAGE, handleStreamingTalkingMessage],
      [StreamingEvents.USER_END_MESSAGE, handleEndMessage],
      [StreamingEvents.AVATAR_END_MESSAGE, handleEndMessage],
    ];

    listeners.forEach(([event, handler]) => {
      avatar.on(event, handler);
    });

    listenersRef.current = listeners;
  }, [
    avatarRef,
    handleAvatarStartTalking,
    handleAvatarStopTalking,
    handleConnectionQualityChange,
    handleEndMessage,
    handleStreamReady,
    handleStreamDisconnected,
    handleStreamingTalkingMessage,
    handleUserStart,
    handleUserStop,
    handleUserTalkingMessage,
  ]);

  const start = useCallback(
    async (config: StartAvatarRequest, token?: string) => {
      if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
        throw new Error("There is already an active session");
      }

      if (!avatarRef.current) {
        if (!token) {
          throw new Error("Token is required");
        }
        init(token);
      }

      if (!avatarRef.current) {
        throw new Error("Avatar is not initialized");
      }

      setSessionState(StreamingAvatarSessionState.CONNECTING);
      attachListeners();

      try {
        const result = await avatarRef.current.createStartAvatar(config);

        // Try to get session_id from the result if available
        if (result && typeof result === "object" && "session_id" in result) {
          setSessionId((result as { session_id: string }).session_id);
        }
      } catch (error) {
        detachListeners();
        setSessionState(StreamingAvatarSessionState.INACTIVE);
        setSessionId(null);

        throw error;
      }

      return avatarRef.current;
    },
    [
      init,
      attachListeners,
      detachListeners,
      sessionState,
      avatarRef,
      setSessionState,
      setSessionId,
    ],
  );

  const closeSession = useCallback(
    async (sessionIdToClose: string) => {
      try {
        const response = await fetch("/api/avatar/close-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: sessionIdToClose }),
        });

        if (!response.ok) {
          console.error("Failed to close session via API");
        }
      } catch (error) {
        console.error("Error closing session via API:", error);
      } finally {
        // Always stop the local session state regardless of API call result
        await stop();
      }
    },
    [stop],
  );

  // Detect when session is in CONNECTING state for too long (timeout)
  // This handles cases where the session is closed externally before stream is ready
  useEffect(() => {
    if (sessionState !== StreamingAvatarSessionState.CONNECTING) {
      return;
    }

    const connectingStartTime = Date.now();
    const CONNECTING_TIMEOUT = 5000; // 5 seconds - faster timeout for immediate detection

    // Check periodically if we're still connecting without a stream
    const checkInterval = setInterval(() => {
      const elapsed = Date.now() - connectingStartTime;
      
      // If we've been connecting for too long without a stream, reset
      // This handles cases where the session is closed externally before stream is ready
      if (
        !stream &&
        sessionState === StreamingAvatarSessionState.CONNECTING &&
        elapsed >= CONNECTING_TIMEOUT
      ) {
        console.log("Connection timeout (session may have been closed externally), resetting session state");
        setSessionState(StreamingAvatarSessionState.INACTIVE);
        setSessionId(null);
        clearInterval(checkInterval);
      }
    }, 500); // Check every 500ms for faster detection

    return () => {
      clearInterval(checkInterval);
    };
  }, [sessionState, stream, setSessionState, setSessionId]);

  // Detect when stream is disconnected externally (e.g., via API call)
  useEffect(() => {
    if (!stream || sessionState === StreamingAvatarSessionState.INACTIVE) {
      return;
    }

    // Store stream reference to avoid stale closures
    const currentStream = stream;
    let isCleanedUp = false;

    const checkStreamActive = () => {
      if (isCleanedUp) {
        return;
      }

      // Check if stream is still active
      if (currentStream && !currentStream.active) {
        console.log("Stream is no longer active, stopping session");
        isCleanedUp = true;
        stop();
        return;
      }

      // Check if any tracks have ended
      try {
        const endedTracks = currentStream
          .getTracks()
          .filter((track) => track.readyState === "ended");
        if (endedTracks.length > 0) {
          console.log("Stream tracks have ended, stopping session");
          isCleanedUp = true;
          stop();
          return;
        }
      } catch (error) {
        // Stream may have been cleaned up
        console.log("Error checking stream tracks, stopping session", error);
        isCleanedUp = true;
        stop();
      }
    };

    // Set up listeners for track ended events
    const handleTrackEnded = () => {
      if (isCleanedUp) {
        return;
      }
      console.log("Stream track ended, stopping session");
      isCleanedUp = true;
      stop();
    };

    const tracks = currentStream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener("ended", handleTrackEnded);
    });

    // Periodic check for stream state (fallback)
    const intervalId = setInterval(checkStreamActive, 1000);

    return () => {
      isCleanedUp = true;
      tracks.forEach((track) => {
        track.removeEventListener("ended", handleTrackEnded);
      });
      clearInterval(intervalId);
    };
  }, [stream, sessionState, stop]);

  return {
    avatarRef,
    sessionState,
    stream,
    sessionId,
    initAvatar: init,
    startAvatar: start,
    stopAvatar: stop,
    closeSession,
  };
};
