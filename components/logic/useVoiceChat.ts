import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";
import { NarrationMode } from "./narrationMode";

export const useVoiceChat = () => {
  const {
    avatarRef,
    narrationMode,
    isMuted,
    setIsMuted,
    isVoiceChatActive,
    setIsVoiceChatActive,
    isVoiceChatLoading,
    setIsVoiceChatLoading,
  } = useStreamingAvatarContext();

  const startVoiceChat = useCallback(
    async (isInputAudioMuted?: boolean) => {
      if (narrationMode !== NarrationMode.CONVERSATIONAL) {
        console.info("Voice chat is disabled in webhook narration mode.");
        setIsVoiceChatLoading(false);
        setIsVoiceChatActive(false);
        setIsMuted(true);

        return;
      }

      if (!avatarRef.current) {
        return;
      }
      setIsVoiceChatLoading(true);
      await avatarRef.current?.startVoiceChat({
        isInputAudioMuted,
      });
      setIsVoiceChatLoading(false);
      setIsVoiceChatActive(true);
      setIsMuted(!!isInputAudioMuted);
    },
    [
      narrationMode,
      avatarRef,
      setIsMuted,
      setIsVoiceChatActive,
      setIsVoiceChatLoading,
    ],
  );

  const stopVoiceChat = useCallback(() => {
    if (!avatarRef.current) {
      return;
    }
    avatarRef.current?.closeVoiceChat();
    setIsVoiceChatActive(false);
    setIsMuted(true);
  }, [avatarRef, setIsMuted, setIsVoiceChatActive]);

  const muteInputAudio = useCallback(() => {
    if (!avatarRef.current || narrationMode !== NarrationMode.CONVERSATIONAL) {
      return;
    }
    avatarRef.current?.muteInputAudio();
    setIsMuted(true);
  }, [avatarRef, narrationMode, setIsMuted]);

  const unmuteInputAudio = useCallback(() => {
    if (!avatarRef.current || narrationMode !== NarrationMode.CONVERSATIONAL) {
      return;
    }
    avatarRef.current?.unmuteInputAudio();
    setIsMuted(false);
  }, [avatarRef, narrationMode, setIsMuted]);

  return {
    startVoiceChat,
    stopVoiceChat,
    muteInputAudio,
    unmuteInputAudio,
    isMuted,
    isVoiceChatActive,
    isVoiceChatLoading,
  };
};
