import React, { forwardRef } from "react";
import { ConnectionQuality } from "@heygen/streaming-avatar";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { StreamingAvatarSessionState } from "../logic";
import { StreamingAvatarSessionState, useWebhookMessage } from "../logic";
import { CloseIcon } from "../Icons";
import { Button } from "../Button";

export const AvatarVideo = forwardRef<HTMLVideoElement>(({}, ref) => {
  const { sessionState } = useStreamingAvatarSession();
  const { connectionQuality } = useConnectionQuality();
  const { latestWebhookMessage } = useWebhookMessage();

  const isLoaded = sessionState === StreamingAvatarSessionState.CONNECTED;
  const canStop = sessionState !== StreamingAvatarSessionState.INACTIVE;
  const shouldShowConnectionQuality =
    !latestWebhookMessage && connectionQuality !== ConnectionQuality.UNKNOWN;

  return (
    <>
      {latestWebhookMessage ? (
        <div className="absolute top-3 left-3 z-20 max-w-[280px] rounded-lg bg-black/90 px-3 py-2 text-white shadow-lg">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
            Incoming webhook
          </p>
          <p className="mt-1 text-sm break-words">
            {latestWebhookMessage.message}
          </p>
          {latestWebhookMessage.botId && (
            <p className="mt-1 text-xs text-zinc-300">
              Bot ID: {latestWebhookMessage.botId}
            </p>
          )}
        </div>
      ) : shouldShowConnectionQuality ? (
        <div className="absolute top-3 left-3 rounded-lg bg-black text-white px-3 py-2">
          Connection Quality: {connectionQuality}
        </div>
      ) : null}
      {canStop && (
        <Button
          aria-label="Stop avatar session"
          className="absolute top-3 right-3 z-20 flex items-center gap-2 !px-4 !py-2 bg-red-600 text-xs font-semibold uppercase tracking-wide shadow-lg transition hover:bg-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-200"
          title="Stop avatar session"
          type="button"
          onClick={stopAvatar}
        >
          <CloseIcon aria-hidden="true" className="h-4 w-4" />
          <span>Stop</span>
        </Button>
      )}
      <video
        ref={ref}
        autoPlay
        playsInline
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
        }}
      >
        <track kind="captions" />
      </video>
      {!isLoaded && (
        <div className="w-full h-full flex items-center justify-center absolute top-0 left-0">
          Loading...
        </div>
      )}
    </>
  );
});
AvatarVideo.displayName = "AvatarVideo";
