import React, { forwardRef } from "react";
import { ConnectionQuality } from "@heygen/streaming-avatar";

import { useConnectionQuality } from "../logic/useConnectionQuality";
import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { StreamingAvatarSessionState } from "../logic";
import { SessionIdDisplay } from "./SessionIdDisplay";

export const AvatarVideo = forwardRef<HTMLVideoElement>(({}, ref) => {
  const { sessionState } = useStreamingAvatarSession();
  const { connectionQuality } = useConnectionQuality();

  const isLoaded = sessionState === StreamingAvatarSessionState.CONNECTED;
  const shouldShowConnectionQuality =
    connectionQuality !== ConnectionQuality.UNKNOWN;

  return (
    <>
      {shouldShowConnectionQuality ? (
        <div className="absolute top-3 left-3 z-10 rounded-lg bg-black/90 text-white px-3 py-2">
          Connection Quality: {connectionQuality}
        </div>
      ) : null}
      <SessionIdDisplay />
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
