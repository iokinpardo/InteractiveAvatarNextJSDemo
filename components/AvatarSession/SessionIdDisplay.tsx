import React from "react";

import { useStreamingAvatarSession } from "../logic/useStreamingAvatarSession";
import { StreamingAvatarSessionState } from "../logic";

export const SessionIdDisplay: React.FC = () => {
  const { sessionId, sessionState } = useStreamingAvatarSession();

  if (
    sessionState !== StreamingAvatarSessionState.CONNECTED ||
    !sessionId
  ) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
    } catch (error) {
      console.error("Failed to copy session ID:", error);
    }
  };

  return (
    <div className="absolute top-3 right-3 z-20 max-w-[280px] rounded-lg bg-black/90 px-3 py-2 text-white shadow-lg">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">
        Session ID
      </p>
      <p className="mt-1 break-all text-xs font-mono">{sessionId}</p>
      <button
        onClick={handleCopy}
        className="mt-2 text-xs text-blue-400 transition hover:text-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-200"
        type="button"
      >
        Copiar
      </button>
    </div>
  );
};

