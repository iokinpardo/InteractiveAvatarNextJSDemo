import StreamingAvatar, {
  ConnectionQuality,
  StreamingTalkingMessageEvent,
  UserTalkingMessageEvent,
} from "@heygen/streaming-avatar";
import React, { useCallback, useMemo, useRef, useState } from "react";

import {
  buildNormalizedWakeWordList,
  findMatchingWakeWord,
  normalizeWakeWord,
} from "@/app/lib/wakeWords";

export enum StreamingAvatarSessionState {
  INACTIVE = "inactive",
  CONNECTING = "connecting",
  CONNECTED = "connected",
}

export enum MessageSender {
  CLIENT = "CLIENT",
  AVATAR = "AVATAR",
}

export interface Message {
  id: string;
  sender: MessageSender;
  content: string;
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

  wakeWord?: string;
  wakeWords: string[];
  activeWakeWord: string | null;
  setActiveWakeWord: (wakeWord: string | null) => void;
  evaluateWakeWord: (message: string) => void;
  resetWakeWord: () => void;
  isWakeWordRequired: boolean;
  isWakeWordActive: boolean;
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
    wakeWord: undefined,
    wakeWords: [],
    activeWakeWord: null,
    setActiveWakeWord: () => {},
    evaluateWakeWord: () => {},
    resetWakeWord: () => {},
    isWakeWordRequired: false,
    isWakeWordActive: true,
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

const useStreamingAvatarMessageState = ({
  onUserMessageChunk,
}: {
  onUserMessageChunk?: (message: string) => void;
} = {}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const currentSenderRef = useRef<MessageSender | null>(null);

  const handleUserTalkingMessage = ({
    detail,
  }: {
    detail: UserTalkingMessageEvent;
  }) => {
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

    onUserMessageChunk?.(detail.message);
  };

  const handleStreamingTalkingMessage = ({
    detail,
  }: {
    detail: StreamingTalkingMessageEvent;
  }) => {
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
  };

  const handleEndMessage = () => {
    currentSenderRef.current = null;
  };

  return {
    messages,
    clearMessages: () => {
      setMessages([]);
      currentSenderRef.current = null;
    },
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

const useStreamingAvatarWakeWordState = ({
  wakeWord,
  wakeWords,
}: {
  wakeWord?: string;
  wakeWords?: string[];
}) => {
  const sanitizedWakeWords = useMemo(
    () =>
      (wakeWords ?? [])
        .map((word) => word.trim())
        .filter((word) => word.length > 0),
    [wakeWords],
  );
  const normalizedWakeWord = useMemo(
    () => normalizeWakeWord(wakeWord),
    [wakeWord],
  );
  const normalizedWakeWords = useMemo(
    () => buildNormalizedWakeWordList(wakeWord, sanitizedWakeWords),
    [wakeWord, sanitizedWakeWords],
  );

  const [activeWakeWord, setActiveWakeWord] = useState<string | null>(null);

  const evaluateWakeWord = useCallback(
    (message: string) => {
      if (!message) {
        return;
      }

      const matchedWakeWord = findMatchingWakeWord(
        message,
        normalizedWakeWords,
      );

      if (matchedWakeWord) {
        setActiveWakeWord(matchedWakeWord);
      }
    },
    [normalizedWakeWords],
  );

  const resetWakeWord = useCallback(() => {
    setActiveWakeWord(null);
  }, []);

  const isWakeWordRequired = Boolean(normalizedWakeWord);
  const isWakeWordActive = !isWakeWordRequired
    ? true
    : activeWakeWord === normalizedWakeWord;

  return {
    wakeWord,
    wakeWords: sanitizedWakeWords,
    activeWakeWord,
    setActiveWakeWord,
    evaluateWakeWord,
    resetWakeWord,
    isWakeWordRequired,
    isWakeWordActive,
  };
};

export const StreamingAvatarProvider = ({
  children,
  basePath,
  wakeWord,
  wakeWords,
}: {
  children: React.ReactNode;
  basePath?: string;
  wakeWord?: string;
  wakeWords?: string[];
}) => {
  const avatarRef = React.useRef<StreamingAvatar>(null);
  const voiceChatState = useStreamingAvatarVoiceChatState();
  const sessionState = useStreamingAvatarSessionState();
  const wakeWordState = useStreamingAvatarWakeWordState({
    wakeWord,
    wakeWords,
  });
  const messageState = useStreamingAvatarMessageState({
    onUserMessageChunk: wakeWordState.evaluateWakeWord,
  });
  const listeningState = useStreamingAvatarListeningState();
  const talkingState = useStreamingAvatarTalkingState();
  const connectionQualityState = useStreamingAvatarConnectionQualityState();

  return (
    <StreamingAvatarContext.Provider
      value={{
        avatarRef,
        basePath,
        ...voiceChatState,
        ...sessionState,
        ...messageState,
        ...listeningState,
        ...talkingState,
        ...connectionQualityState,
        ...wakeWordState,
      }}
    >
      {children}
    </StreamingAvatarContext.Provider>
  );
};

export const useStreamingAvatarContext = () => {
  return React.useContext(StreamingAvatarContext);
};
