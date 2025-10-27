"use client";

import {
  AvatarQuality,
  StreamingEvents,
  VoiceChatTransport,
  VoiceEmotion,
  StartAvatarRequest,
  STTProvider,
  ElevenLabsModel,
} from "@heygen/streaming-avatar";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { useVoiceChat } from "./logic/useVoiceChat";
import {
  StreamingAvatarProvider,
  StreamingAvatarSessionState,
  useStreamingAvatarContext,
} from "./logic";
import { LoadingIcon } from "./Icons";

type CreateDefaultConfigArgs = {
  systemPrompt?: string;
  avatarId?: string;
  voiceOverrides?: VoiceOverrides;
};

export type VoiceOverrides = Partial<
  Pick<
    NonNullable<StartAvatarRequest["voice"]>,
    "voiceId" | "emotion" | "model"
  >
>;

const sanitizeVoiceOverrides = (
  overrides?: VoiceOverrides,
): VoiceOverrides | undefined => {
  if (!overrides) {
    return undefined;
  }

  const sanitized: VoiceOverrides = {};

  if (overrides.voiceId?.trim()) {
    sanitized.voiceId = overrides.voiceId.trim();
  }

  if (overrides.emotion) {
    sanitized.emotion = overrides.emotion;
  }

  if (overrides.model) {
    sanitized.model = overrides.model;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const createDefaultConfig = ({
  systemPrompt,
  avatarId,
  voiceOverrides,
}: CreateDefaultConfigArgs): StartAvatarRequest => ({
  quality: AvatarQuality.Low,
  avatarName: avatarId ?? "Ann_Therapist_public",
  knowledgeId: undefined,
  ...(systemPrompt ? { knowledgeBase: systemPrompt } : {}),
  voice: {
    rate: 1.5,
    emotion: voiceOverrides?.emotion ?? VoiceEmotion.EXCITED,
    model: voiceOverrides?.model ?? ElevenLabsModel.eleven_flash_v2_5,
    ...(voiceOverrides?.voiceId ? { voiceId: voiceOverrides.voiceId } : {}),
  },
  language: "en",
  voiceChatTransport: VoiceChatTransport.WEBSOCKET,
  sttSettings: {
    provider: STTProvider.DEEPGRAM,
  },
});

type InteractiveAvatarProps = {
  systemPrompt?: string;
  avatarId?: string;
  voiceOverrides?: VoiceOverrides;
  expertName?: string;
};

function InteractiveAvatar({
  systemPrompt,
  avatarId,
  voiceOverrides,
  expertName,
}: InteractiveAvatarProps) {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();
  const { isWakeWordActive, isWakeWordRequired } = useStreamingAvatarContext();

  const mediaStream = useRef<HTMLVideoElement>(null);
  const hasStarted = useRef(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [voiceChatWarning, setVoiceChatWarning] = useState<string | null>(null);

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === "string") {
      return error;
    }

    return "Unknown error occurred.";
  };

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const startSession = useMemoizedFn(async () => {
    try {
      setSessionError(null);
      setVoiceChatWarning(null);

      const tokenPromise = fetchAccessToken();

      if (sessionState !== StreamingAvatarSessionState.INACTIVE) {
        await stopAvatar();
      }

      const newToken = await tokenPromise;
      const avatar = initAvatar(newToken);

      avatar.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
        console.log("Avatar started talking", e);
      });
      avatar.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
        console.log("Avatar stopped talking", e);
      });
      avatar.on(StreamingEvents.STREAM_DISCONNECTED, () => {
        console.log("Stream disconnected");
      });
      avatar.on(StreamingEvents.STREAM_READY, (event) => {
        console.log(">>>>> Stream ready:", event.detail);
      });
      avatar.on(StreamingEvents.USER_START, (event) => {
        console.log(">>>>> User started talking:", event);
      });
      avatar.on(StreamingEvents.USER_STOP, (event) => {
        console.log(">>>>> User stopped talking:", event);
      });
      avatar.on(StreamingEvents.USER_END_MESSAGE, (event) => {
        console.log(">>>>> User end message:", event);
      });
      avatar.on(StreamingEvents.USER_TALKING_MESSAGE, (event) => {
        console.log(">>>>> User talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (event) => {
        console.log(">>>>> Avatar talking message:", event);
      });
      avatar.on(StreamingEvents.AVATAR_END_MESSAGE, (event) => {
        console.log(">>>>> Avatar end message:", event);
      });

      const sanitizedSystemPrompt = systemPrompt?.trim() || undefined;
      const sanitizedAvatarId = avatarId?.trim() || undefined;
      const sanitizedVoiceOverrides = sanitizeVoiceOverrides(voiceOverrides);

      const startConfig = createDefaultConfig({
        systemPrompt: sanitizedSystemPrompt,
        avatarId: sanitizedAvatarId,
        voiceOverrides: sanitizedVoiceOverrides,
      });

      if (sanitizedSystemPrompt) {
        console.log(
          "Applying system prompt as knowledgeBase",
          sanitizedSystemPrompt,
        );
      }

      if (sanitizedAvatarId) {
        console.log("Using avatar override", sanitizedAvatarId);
      }

      if (sanitizedVoiceOverrides) {
        console.log("Applying voice overrides", sanitizedVoiceOverrides);
      }

      await startAvatar(startConfig);

      try {
        await startVoiceChat();
        setVoiceChatWarning(null);
      } catch (voiceChatError) {
        const warningMessage =
          "Voice chat could not start automatically. The avatar is running without microphone input.";

        console.warn(warningMessage, voiceChatError);
        setVoiceChatWarning(
          `${warningMessage} (${getErrorMessage(voiceChatError)})`,
        );
      }
    } catch (error) {
      hasStarted.current = false;
      const message = getErrorMessage(error);

      setSessionError(message);
      console.error("Error starting avatar session:", error);
    }
  });

  const handleRetrySession = useMemoizedFn(() => {
    if (sessionState === StreamingAvatarSessionState.CONNECTING) {
      return;
    }

    hasStarted.current = true;
    startSession();
  });

  const handleRetryVoiceChat = useMemoizedFn(async () => {
    if (sessionState !== StreamingAvatarSessionState.CONNECTED) {
      return;
    }

    try {
      await startVoiceChat();
      setVoiceChatWarning(null);
    } catch (error) {
      const retryMessage = "Voice chat is still unavailable.";

      console.warn(retryMessage, error);
      setVoiceChatWarning(`${retryMessage} (${getErrorMessage(error)})`);
    }
  });

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startSession();
    }
  }, [startSession]);

  useUnmount(() => {
    stopAvatar();
  });

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full max-w-[900px]">
      <div className="relative w-full aspect-video overflow-hidden rounded-3xl bg-zinc-900">
        <AvatarVideo ref={mediaStream} />
        {isWakeWordRequired &&
        isWakeWordActive &&
        sessionState === StreamingAvatarSessionState.CONNECTED ? (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-amber-400/90 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-950 shadow-lg">
            Active
          </div>
        ) : null}
        {sessionState !== StreamingAvatarSessionState.CONNECTED ? (
          <div
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 px-6 text-center"
          >
            {sessionError ? (
              <>
                <span className="text-sm font-semibold text-red-200">
                  Unable to start the avatar session
                </span>
                <p className="text-xs text-red-200/80">{sessionError}</p>
                <button
                  className="rounded-full border border-red-400/40 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-100 transition hover:border-red-300 hover:bg-red-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200"
                  type="button"
                  onClick={handleRetrySession}
                >
                  Try again
                </button>
              </>
            ) : (
              <>
                <LoadingIcon className="animate-spin" />
                <span className="text-sm text-zinc-300">
                  {expertName?.trim()
                    ? `connecting ${expertName.trim().toLowerCase()}…`
                    : "Connecting to the avatar…"}
                </span>
              </>
            )}
          </div>
        ) : null}
      </div>
      {voiceChatWarning ? (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="mb-3 text-left">{voiceChatWarning}</p>
          <button
            className="rounded-full border border-amber-400/40 bg-transparent px-3 py-1 text-xs font-medium text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            type="button"
            onClick={handleRetryVoiceChat}
          >
            Retry voice chat
          </button>
        </div>
      ) : null}
      <div className="rounded-3xl bg-zinc-900/70 p-4">
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-400">
          Conversation Transcript
        </h2>
        <MessageHistory />
      </div>
    </div>
  );
}

type InteractiveAvatarWrapperProps = {
  systemPrompt?: string;
  avatarId?: string;
  voiceOverrides?: VoiceOverrides;
  expertName?: string;
  wakeWord?: string;
  wakeWords?: string[];
};

export default function InteractiveAvatarWrapper({
  systemPrompt,
  avatarId,
  voiceOverrides,
  expertName,
  wakeWord,
  wakeWords,
}: InteractiveAvatarWrapperProps) {
  return (
    <StreamingAvatarProvider
      basePath={process.env.NEXT_PUBLIC_BASE_API_URL}
      wakeWord={wakeWord}
      wakeWords={wakeWords}
    >
      <InteractiveAvatar
        avatarId={avatarId}
        expertName={expertName}
        systemPrompt={systemPrompt}
        voiceOverrides={voiceOverrides}
      />
    </StreamingAvatarProvider>
  );
}
