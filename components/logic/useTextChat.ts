import { TaskMode, TaskType } from "@heygen/streaming-avatar";
import { useCallback } from "react";

import { useStreamingAvatarContext } from "./context";
import { NarrationMode } from "./narrationMode";

export const useTextChat = () => {
  const { avatarRef, narrationMode } = useStreamingAvatarContext();

  const getConversationalAvatar = useCallback(() => {
    const avatar = avatarRef.current;

    if (!avatar || narrationMode !== NarrationMode.CONVERSATIONAL) {
      console.info("Text chat is disabled in webhook narration mode.");

      return null;
    }

    return avatar;
  }, [avatarRef, narrationMode]);

  const sendMessage = useCallback(
    (message: string) => {
      const avatar = getConversationalAvatar();

      if (!avatar) {
        return;
      }

      avatar.speak({
        text: message,
        taskType: TaskType.TALK,
        taskMode: TaskMode.ASYNC,
      });
    },
    [getConversationalAvatar],
  );

  const sendMessageSync = useCallback(
    async (message: string) => {
      const avatar = getConversationalAvatar();

      if (!avatar) {
        return;
      }

      return await avatar.speak({
        text: message,
        taskType: TaskType.TALK,
        taskMode: TaskMode.SYNC,
      });
    },
    [getConversationalAvatar],
  );

  const repeatMessage = useCallback(
    (message: string) => {
      const avatar = getConversationalAvatar();

      if (!avatar) {
        return;
      }

      return avatar.speak({
        text: message,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.ASYNC,
      });
    },
    [getConversationalAvatar],
  );

  const repeatMessageSync = useCallback(
    async (message: string) => {
      const avatar = getConversationalAvatar();

      if (!avatar) {
        return;
      }

      return await avatar.speak({
        text: message,
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC,
      });
    },
    [getConversationalAvatar],
  );

  return {
    sendMessage,
    sendMessageSync,
    repeatMessage,
    repeatMessageSync,
  };
};
