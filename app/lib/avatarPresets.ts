import type { VoiceOverrides } from "@/components/InteractiveAvatar";

import { VoiceEmotion } from "@heygen/streaming-avatar";

export const EXPERT_VALUES = ["marketing", "finance"] as const;

export type ExpertKey = (typeof EXPERT_VALUES)[number];

export type AvatarPreset = {
  /**
   * Optional system prompt applied before query string overrides.
   */
  systemPrompt?: string;
  /**
   * Optional avatar ID applied before query string overrides.
   */
  avatarId?: string;
  /**
   * Optional voice overrides applied before query string overrides.
   */
  voiceOverrides?: VoiceOverrides;
};

export const DEFAULT_EXPERT: ExpertKey = "marketing";

export const AVATAR_PRESETS: Record<ExpertKey, AvatarPreset> = {
  marketing: {},
  finance: {
    avatarId: "Dexter_Doctor_Standing2_public",
    systemPrompt:
      "You are a calm and detail-oriented financial advisor who explains budgeting, forecasting, and investment concepts clearly.",
    voiceOverrides: {
      emotion: VoiceEmotion.SERIOUS,
    },
  },
};

export const resolveExpert = (value?: string | null): ExpertKey => {
  if (!value) {
    return DEFAULT_EXPERT;
  }

  const normalized = value.trim().toLowerCase();

  return (
    EXPERT_VALUES.find((expert) => expert === normalized) ?? DEFAULT_EXPERT
  );
};
