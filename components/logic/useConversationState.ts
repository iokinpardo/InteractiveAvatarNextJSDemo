import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";
import { NarrationMode } from "./narrationMode";

export const useConversationState = () => {
  const {
    avatarRef,
    isAvatarTalking,
    isUserTalking,
    isListening,
    narrationMode,
  } = useStreamingAvatarContext();

  const startListening = useCallback(() => {
    if (!avatarRef.current || narrationMode !== NarrationMode.CONVERSATIONAL) {
      return;
    }
    avatarRef.current.startListening();
  }, [avatarRef, narrationMode]);

  const stopListening = useCallback(() => {
    if (!avatarRef.current || narrationMode !== NarrationMode.CONVERSATIONAL) {
      return;
    }
    avatarRef.current.stopListening();
  }, [avatarRef, narrationMode]);

  return {
    isAvatarListening: isListening,
    startListening,
    stopListening,
    isUserTalking,
    isAvatarTalking,
  };
};
