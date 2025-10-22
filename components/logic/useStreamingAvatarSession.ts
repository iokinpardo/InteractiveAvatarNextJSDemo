import StreamingAvatar, {
  ConnectionQuality,
  StartAvatarRequest,
  StreamingEvents,
  StreamingTalkingMessageEvent,
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
    setIsListening,
    setIsUserTalking,
    setIsAvatarTalking,
    setConnectionQuality,
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    clearMessages,
    resetWakeWord,
    isWakeWordRequired,
    isWakeWordActive,
  } = useStreamingAvatarContext();
  const { stopVoiceChat } = useVoiceChat();

  useMessageHistory();

  const listenersRef = useRef<Array<[StreamingEvents, EventHandler]>>([]);
  const wakeWordActiveRef = useRef(isWakeWordActive);

  useEffect(() => {
    wakeWordActiveRef.current = isWakeWordActive;
  }, [isWakeWordActive]);

  const isConversationActive = useCallback(() => {
    if (!isWakeWordRequired) {
      return true;
    }

    return wakeWordActiveRef.current;
  }, [isWakeWordRequired]);

  const handleAvatarTalkingMessage = useCallback(
    (event: { detail: StreamingTalkingMessageEvent }) => {
      if (!isConversationActive()) {
        return;
      }

      handleStreamingTalkingMessage(event);
    },
    [handleStreamingTalkingMessage, isConversationActive],
  );

  const handleUserEndMessage = useCallback(() => {
    handleEndMessage();

    if (!isConversationActive()) {
      avatarRef.current?.interrupt();
    }
  }, [avatarRef, handleEndMessage, isConversationActive]);

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
    resetWakeWord();
    stopVoiceChat();
    setIsListening(false);
    setIsUserTalking(false);
    setIsAvatarTalking(false);
    setStream(null);
    await avatarRef.current?.stopAvatar();
    setSessionState(StreamingAvatarSessionState.INACTIVE);
  }, [
    detachListeners,
    avatarRef,
    setIsListening,
    stopVoiceChat,
    clearMessages,
    resetWakeWord,
    setIsUserTalking,
    setIsAvatarTalking,
    setStream,
    setSessionState,
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
      [StreamingEvents.AVATAR_TALKING_MESSAGE, handleAvatarTalkingMessage],
      [StreamingEvents.USER_END_MESSAGE, handleUserEndMessage],
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
    handleAvatarTalkingMessage,
    handleUserEndMessage,
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
        await avatarRef.current.createStartAvatar(config);
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
