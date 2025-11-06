import { useStreamingAvatarContext } from "./context";

export const useWebhookMessage = () => {
  const { latestWebhookMessage } = useStreamingAvatarContext();

  return { latestWebhookMessage };
};
