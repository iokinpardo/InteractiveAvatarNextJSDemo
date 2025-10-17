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
import { useEffect, useRef } from "react";
import { useMemoizedFn, useUnmount } from "ahooks";

import { AvatarVideo } from "./AvatarSession/AvatarVideo";
import { MessageHistory } from "./AvatarSession/MessageHistory";
import { useStreamingAvatarSession } from "./logic/useStreamingAvatarSession";
import { useVoiceChat } from "./logic/useVoiceChat";
import { StreamingAvatarProvider, StreamingAvatarSessionState } from "./logic";
import { LoadingIcon } from "./Icons";

type CreateDefaultConfigArgs = {
  systemPrompt?: string;
  avatarId?: string;
};

const createDefaultConfig = ({
  systemPrompt,
  avatarId,
}: CreateDefaultConfigArgs): StartAvatarRequest => ({
  quality: AvatarQuality.Low,
  avatarName: avatarId ?? "Ann_Therapist_public",
  knowledgeId: undefined,
  ...(systemPrompt ? { knowledgeBase: systemPrompt } : {}),
  voice: {
    rate: 1.5,
    emotion: VoiceEmotion.EXCITED,
    model: ElevenLabsModel.eleven_flash_v2_5,
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
};

function InteractiveAvatar({ systemPrompt, avatarId }: InteractiveAvatarProps) {
  const { initAvatar, startAvatar, stopAvatar, sessionState, stream } =
    useStreamingAvatarSession();
  const { startVoiceChat } = useVoiceChat();

  const mediaStream = useRef<HTMLVideoElement>(null);
  const hasStarted = useRef(false);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
      throw error;
    }
  }

  const startSession = useMemoizedFn(async () => {
    try {
      const newToken = await fetchAccessToken();
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
      const startConfig = createDefaultConfig({
        systemPrompt: sanitizedSystemPrompt,
        avatarId: sanitizedAvatarId,
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

      await startAvatar(startConfig);
      await startVoiceChat();
    } catch (error) {
      console.error("Error starting avatar session:", error);
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
    <div className="w-full max-w-[900px] space-y-4">
      <div className="relative w-full aspect-video overflow-hidden rounded-3xl bg-zinc-900">
        <AvatarVideo ref={mediaStream} />
        {sessionState !== StreamingAvatarSessionState.CONNECTED && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900">
            <LoadingIcon className="animate-spin" />
            <span className="text-sm text-zinc-300">Starting voice chat…</span>
          </div>
        )}
      </div>
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
};

export default function InteractiveAvatarWrapper({
  systemPrompt,
  avatarId,
}: InteractiveAvatarWrapperProps) {
  return (
    <StreamingAvatarProvider basePath={process.env.NEXT_PUBLIC_BASE_API_URL}>
      <InteractiveAvatar avatarId={avatarId} systemPrompt={systemPrompt} />
    </StreamingAvatarProvider>
  );
}
