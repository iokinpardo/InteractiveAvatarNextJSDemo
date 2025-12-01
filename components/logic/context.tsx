"use client";

import type { SessionConfigUpdate } from "@/app/lib/sessionConfig";

import StreamingAvatar, {
  ConnectionQuality,
  StreamingTalkingMessageEvent,
  UserTalkingMessageEvent,
} from "@heygen/streaming-avatar";
import React, { useCallback, useRef, useState } from "react";

import { NarrationMode } from "./narrationMode";

export enum StreamingAvatarSessionState {
  INACTIVE = "inactive",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  DISCONNECTING = "disconnecting",
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
  narrationMode: NarrationMode;

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
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
  customSessionId: string | null;
  setCustomSessionId: (customSessionId: string | null) => void;

  messages: Message[];
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

  isListening: boolean;
  setIsListening: (isListening: boolean) => void;
  isUserTalking: boolean;
  setIsUserTalking: (isUserTalking: boolean) => void;
  isAvatarTalking: boolean;
  setIsAvatarTalking: (isAvatarTalking: boolean) => void;

  connectionQuality: ConnectionQuality;
  setConnectionQuality: (connectionQuality: ConnectionQuality) => void;

  pendingConfigUpdate: SessionConfigUpdate | null;
  setPendingConfigUpdate: (config: SessionConfigUpdate | null) => void;

  isExplicitlyClosed: boolean;
  setIsExplicitlyClosed: (isExplicitlyClosed: boolean) => void;
};

const StreamingAvatarContext = React.createContext<StreamingAvatarContextProps>(
  {
    avatarRef: { current: null },
    narrationMode: NarrationMode.CONVERSATIONAL,
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
    sessionId: null,
    setSessionId: () => {},
    customSessionId: null,
    setCustomSessionId: () => {},
    messages: [],
    clearMessages: () => {},
    handleUserTalkingMessage: () => {},
    handleStreamingTalkingMessage: () => {},
    handleEndMessage: () => {},
    isListening: false,
    setIsListening: () => {},
    isUserTalking: false,
    setIsUserTalking: () => {},
    isAvatarTalking: false,
    setIsAvatarTalking: () => {},
    connectionQuality: ConnectionQuality.UNKNOWN,
    setConnectionQuality: () => {},
    pendingConfigUpdate: null,
    setPendingConfigUpdate: () => {},
    isExplicitlyClosed: false,
    setIsExplicitlyClosed: () => {},
  },
);

const useStreamingAvatarSessionState = () => {
  const [sessionState, setSessionState] = useState(
    StreamingAvatarSessionState.INACTIVE,
  );
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [customSessionId, setCustomSessionId] = useState<string | null>(null);

  return {
    sessionState,
    setSessionState,
    stream,
    setStream,
    sessionId,
    setSessionId,
    customSessionId,
    setCustomSessionId,
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
  const currentSenderRef = useRef<MessageSender | null>(null);

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

  return {
    messages,
    clearMessages: useCallback(() => {
      setMessages([]);
      currentSenderRef.current = null;
    }, []),
    handleUserTalkingMessage,
    handleStreamingTalkingMessage,
    handleEndMessage,
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

const usePendingConfigState = () => {
  const [pendingConfigUpdate, setPendingConfigUpdate] =
    useState<SessionConfigUpdate | null>(null);

  return { pendingConfigUpdate, setPendingConfigUpdate };
};

const useExplicitlyClosedState = () => {
  const [isExplicitlyClosed, setIsExplicitlyClosed] = useState(false);

  return { isExplicitlyClosed, setIsExplicitlyClosed };
};

export const StreamingAvatarProvider = ({
  children,
  basePath,
  narrationMode = NarrationMode.CONVERSATIONAL,
}: {
  children: React.ReactNode;
  basePath?: string;
  narrationMode?: NarrationMode;
}) => {
  const avatarRef = React.useRef<StreamingAvatar>(null);
  const voiceChatState = useStreamingAvatarVoiceChatState();
  const sessionState = useStreamingAvatarSessionState();
  const messageState = useStreamingAvatarMessageState();
  const listeningState = useStreamingAvatarListeningState();
  const talkingState = useStreamingAvatarTalkingState();
  const connectionQualityState = useStreamingAvatarConnectionQualityState();
  const pendingConfigState = usePendingConfigState();
  const explicitlyClosedState = useExplicitlyClosedState();

  return (
    <StreamingAvatarContext.Provider
      value={{
        avatarRef,
        basePath,
        narrationMode,
        ...voiceChatState,
        ...sessionState,
        ...messageState,
        ...listeningState,
        ...talkingState,
        ...connectionQualityState,
        ...pendingConfigState,
        ...explicitlyClosedState,
      }}
    >
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  return React.useContext(StreamingAvatarContext);
};
