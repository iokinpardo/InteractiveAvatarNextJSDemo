import { MessageSender, useStreamingAvatarContext } from "./context";

export const useMessageHistory = () => {
  const { messages } = useStreamingAvatarContext();

  return {
    messages: messages.filter(
      (message) => message.sender !== MessageSender.WEBHOOK,
    ),
  };
};
