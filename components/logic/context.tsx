"use client";

import StreamingAvatar, {
  ConnectionQuality,
  StreamingTalkingMessageEvent,
  UserTalkingMessageEvent,
  TaskMode,
  TaskType,
} from "@heygen/streaming-avatar";
import React, { useCallback, useEffect, useRef, useState } from "react";

export enum StreamingAvatarSessionState {
  INACTIVE = "inactive",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export enum MessageSender {
  CLIENT = "CLIENT",
  AVATAR = "AVATAR",
  WEBHOOK = "WEBHOOK",
}

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
  botId?: string | null;
}

type StreamingAvatarContextProps = {
  avatarRef: React.MutableRefObject<StreamingAvatar | null>;
  basePath?: string;

  isMuted: boolean;
  setIsMuted: (isMuted: boolean) => void;
  isVoiceChatLoading: boolean;
  setIsVoiceChatLoading: (isVoiceChatLoading: boolean) => void;
  isVoiceChatActive: boolean;
  setIsVoiceChatActive: (isVoiceChatActive: boolean) => void;

  sessionState: StreamingAvatarSessionState;
  setSessionState: (sessionState: StreamingAvatarSessionState) => void;
  stream: MediaStream | null;
  setStream: (stream: MediaStream | null) => void;

  messages: Message[];
  latestWebhookMessage: {
    id: string;
    message: string;
    botId: string | null;
  } | null;
  clearMessages: () => void;
  handleUserTalkingMessage: ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => void;
  handleStreamingTalkingMessage: ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => void;
  handleEndMessage: () => void;
  injectWebhookMessage: (payload: {
    id?: string;
    message: string;
    botId?: string | null;
  }) => void;

  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isUserTalking: boolean;
  setIsUserTalking: (isUserTalking: boolean) => void;
  isAvatarTalking: boolean;
  setIsAvatarTalking: (isAvatarTalking: boolean) => void;

  connectionQuality: ConnectionQuality;
  setConnectionQuality: (connectionQuality: ConnectionQuality) => void;
};

const StreamingAvatarContext = React.createContext<StreamingAvatarContextProps>(
  {
    avatarRef: { current: null },
    isMuted: true,
    setIsMuted: () => {},
    isVoiceChatLoading: false,
    setIsVoiceChatLoading: () => {},
    sessionState: StreamingAvatarSessionState.INACTIVE,
    setSessionState: () => {},
    isVoiceChatActive: false,
    setIsVoiceChatActive: () => {},
    stream: null,
    setStream: () => {},
    messages: [],
    latestWebhookMessage: null,
    clearMessages: () => {},
    handleUserTalkingMessage: () => {},
    handleStreamingTalkingMessage: () => {},
    handleEndMessage: () => {},
    injectWebhookMessage: () => {},
    isListening: false,
    setIsListening: () => {},
    isUserTalking: false,
    setIsUserTalking: () => {},
    isAvatarTalking: false,
    setIsAvatarTalking: () => {},
    connectionQuality: ConnectionQuality.UNKNOWN,
    setConnectionQuality: () => {},
  },
);

const useStreamingAvatarSessionState = () => {
  const [sessionState, setSessionState] = useState(
    StreamingAvatarSessionState.INACTIVE,
  );
  const [stream, setStream] = useState<MediaStream | null>(null);

  return {
    sessionState,
    setSessionState,
    stream,
    setStream,
  };
};

const useStreamingAvatarVoiceChatState = () => {
  const [isMuted, setIsMuted] = useState(true);
  const [isVoiceChatLoading, setIsVoiceChatLoading] = useState(false);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);

  return {
    isMuted,
    setIsMuted,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
    isVoiceChatActive,
    setIsVoiceChatActive,
  };
};

const useStreamingAvatarMessageState = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [latestWebhookMessage, setLatestWebhookMessage] = useState<{
    id: string;
    message: string;
    botId: string | null;
  } | null>(null);
  const currentSenderRef = useRef<MessageSender | null>(null);
  const processedWebhookIdsRef = useRef(new Set<string>());

  const handleUserTalkingMessage = useCallback(
    ({ detail }: { detail: UserTalkingMessageEvent }) => {
      if (currentSenderRef.current === MessageSender.CLIENT) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            ...prev[prev.length - 1],
            content: [prev[prev.length - 1].content, detail.message].join(""),
          },
        ]);
      } else {
        currentSenderRef.current = MessageSender.CLIENT;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: MessageSender.CLIENT,
            content: detail.message,
          },
        ]);
      }
    },
    [],
  );

  const handleStreamingTalkingMessage = useCallback(
    ({ detail }: { detail: StreamingTalkingMessageEvent }) => {
      if (currentSenderRef.current === MessageSender.AVATAR) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          {
            ...prev[prev.length - 1],
            content: [prev[prev.length - 1].content, detail.message].join(""),
          },
        ]);
      } else {
        currentSenderRef.current = MessageSender.AVATAR;
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            sender: MessageSender.AVATAR,
            content: detail.message,
          },
        ]);
      }
    },
    [],
  );

  const handleEndMessage = useCallback(() => {
    currentSenderRef.current = null;
  }, []);

  const injectWebhookMessage = useCallback(
    ({
      id,
      message,
      botId,
    }: {
      id?: string;
      message: string;
      botId?: string | null;
    }) => {
      const trimmedMessage = message.trim();

      if (!trimmedMessage) {
        return;
      }

      const messageId = id ?? crypto.randomUUID?.() ?? Date.now().toString();

      if (processedWebhookIdsRef.current.has(messageId)) {
        return;
      }

      processedWebhookIdsRef.current.add(messageId);
      currentSenderRef.current = null;

      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          sender: MessageSender.WEBHOOK,
          content: trimmedMessage,
          botId: botId ?? null,
        },
      ]);

      setLatestWebhookMessage({
        id: messageId,
        message: trimmedMessage,
        botId: botId ?? null,
      });
    },
    [],
  );

  return {
    messages,
    latestWebhookMessage,
    clearMessages: useCallback(() => {
      setMessages([]);
      currentSenderRef.current = null;
      processedWebhookIdsRef.current.clear();
      setLatestWebhookMessage(null);
    }, []),
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
    injectWebhookMessage,
  };
};

const useStreamingAvatarListeningState = () => {
  const [isListening, setIsListening] = useState(false);

  return { isListening, setIsListening };
};

const useStreamingAvatarTalkingState = () => {
  const [isUserTalking, setIsUserTalking] = useState(false);
  const [isAvatarTalking, setIsAvatarTalking] = useState(false);

  return {
    isUserTalking,
    setIsUserTalking,
    isAvatarTalking,
    setIsAvatarTalking,
  };
};

const useStreamingAvatarConnectionQualityState = () => {
  const [connectionQuality, setConnectionQuality] = useState(
    ConnectionQuality.UNKNOWN,
  );

  return { connectionQuality, setConnectionQuality };
};

export const StreamingAvatarProvider = ({
  children,
  basePath,
}: {
  children: React.ReactNode;
  basePath?: string;
}) => {
  const avatarRef = React.useRef<StreamingAvatar>(null);
  const voiceChatState = useStreamingAvatarVoiceChatState();
  const sessionState = useStreamingAvatarSessionState();
  const { injectWebhookMessage, ...messageState } =
    useStreamingAvatarMessageState();
  const listeningState = useStreamingAvatarListeningState();
  const talkingState = useStreamingAvatarTalkingState();
  const connectionQualityState = useStreamingAvatarConnectionQualityState();
  const currentSessionState = sessionState.sessionState;
  const latestWebhookMessage = messageState.latestWebhookMessage;
  const webhookSpeechQueueRef = useRef<Promise<void>>(Promise.resolve());
  const lastSpokenWebhookIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const streamUrl = "/api/webhook/stream";
    const eventSource = new EventSource(streamUrl);

    const handleEvent = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as {
          id?: string;
          message?: string;
          botId?: string | null;
        };

        if (typeof data.message !== "string") {
          return;
        }

        injectWebhookMessage({
          id: data.id,
          message: data.message,
          botId: data.botId ?? null,
        });
      } catch (error) {
        console.error("Failed to parse webhook message", error);
      }
    };

    eventSource.addEventListener("webhook-message", handleEvent);
    eventSource.onerror = (error) => {
      console.error("Webhook stream connection error", error);
    };

    return () => {
      eventSource.removeEventListener("webhook-message", handleEvent);
      eventSource.close();
    };
  }, [injectWebhookMessage]);

  useEffect(() => {
    if (currentSessionState === StreamingAvatarSessionState.INACTIVE) {
      lastSpokenWebhookIdRef.current = null;
      webhookSpeechQueueRef.current = Promise.resolve();
    }
  }, [currentSessionState]);

  useEffect(() => {
    if (
      currentSessionState !== StreamingAvatarSessionState.CONNECTED ||
      !latestWebhookMessage ||
      !latestWebhookMessage.message.trim() ||
      !avatarRef.current
    ) {
      return;
    }

    if (lastSpokenWebhookIdRef.current === latestWebhookMessage.id) {
      return;
    }

    lastSpokenWebhookIdRef.current = latestWebhookMessage.id;

    const speakWebhookMessage = async () => {
      try {
        await avatarRef.current?.speak({
          text: latestWebhookMessage.message,
          taskType: TaskType.TALK,
          taskMode: TaskMode.ASYNC,
        });
      } catch (error) {
        console.error("Failed to speak webhook message", error);
      }
    };

    webhookSpeechQueueRef.current = webhookSpeechQueueRef.current
      .catch(() => undefined)
      .then(speakWebhookMessage);
  }, [avatarRef, currentSessionState, latestWebhookMessage]);

  return (
    <StreamingAvatarContext.Provider
      value={{
        avatarRef,
        basePath,
        ...voiceChatState,
        ...sessionState,
        ...messageState,
        injectWebhookMessage,
        ...listeningState,
        ...talkingState,
        ...connectionQualityState,
      }}
    >
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  return React.useContext(StreamingAvatarContext);
};
