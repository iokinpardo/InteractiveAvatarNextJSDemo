import StreamingAvatar, {
  ConnectionQuality,
  StartAvatarRequest,
  StreamingEvents,
  type EventHandler,
} from "@heygen/streaming-avatar";
import { useCallback, useRef } from "react";

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
  const sessionInfoRef = useRef<{
    sessionId: string;
    token: string;
  } | null>(null);

  const stopSessionViaApi = useCallback(
    async (session?: { sessionId: string; token: string }) => {
      const activeSession = session ?? sessionInfoRef.current;

      if (!activeSession || !basePath) {
        return;
      }

      const url = `${basePath.replace(/\/$/, "")}/v1/streaming.stop`;

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeSession.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ session_id: activeSession.sessionId }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");

          throw new Error(
            `Streaming stop fallback failed with status ${response.status}${
              errorText ? `: ${errorText}` : ""
            }`,
          );
        }
      } catch (error) {
        console.error(
          "Failed to close streaming session via REST fallback",
          error,
        );
      } finally {
        sessionInfoRef.current = null;
      }
    },
    [basePath],
  );

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
    detachListeners();
    clearMessages();
    stopVoiceChat();
    setIsListening(false);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setStream(null);

    const activeSession = sessionInfoRef.current ?? undefined;

    if (!avatarRef.current && activeSession) {
      await stopSessionViaApi(activeSession);
      setSessionState(StreamingAvatarSessionState.INACTIVE);

      return;
    }

    try {
      await avatarRef.current?.stopAvatar();
      sessionInfoRef.current = null;
    } catch (error) {
      console.error("Error stopping streaming avatar session via SDK", error);
      await stopSessionViaApi(activeSession);
    } finally {
      sessionInfoRef.current = null;
      setSessionState(StreamingAvatarSessionState.INACTIVE);
    }
  }, [
    detachListeners,
    avatarRef,
    setIsListening,
    stopVoiceChat,
    clearMessages,
    setIsUserTalking,
    setIsAvatarTalking,
    setStream,
    setSessionState,
    stopSessionViaApi,
  ]);

  const handleStreamDisconnected = useCallback(() => {
    stop();
  }, [stop]);

  const attachListeners = useCallback(() => {
    const avatar = avatarRef.current;

    if (!avatar) {
      return;
    }

    const listeners: Array<[StreamingEvents, EventHandler]> = [
      [StreamingEvents.STREAM_READY, handleStream],
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
    handleStream,
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
        const sessionInfo = await avatarRef.current.createStartAvatar(config);

        if (sessionInfo?.session_id && token) {
          sessionInfoRef.current = {
            sessionId: sessionInfo.session_id,
            token,
          };
        }
      } catch (error) {
        detachListeners();
        setSessionState(StreamingAvatarSessionState.INACTIVE);
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
    ],
  );

  return {
    avatarRef,
    sessionState,
    stream,
    initAvatar: init,
    startAvatar: start,
    stopAvatar: stop,
  };
};
