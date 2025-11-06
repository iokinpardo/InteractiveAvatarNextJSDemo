import { ElevenLabsModel, VoiceEmotion } from "@heygen/streaming-avatar";

import InteractiveAvatar, {
  type VoiceOverrides,
} from "@/components/InteractiveAvatar";
import { AVATAR_PRESETS, resolveExpert } from "@/app/lib/avatarPresets";

type PageSearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<PageSearchParams>;
};

const extractParam = (value?: string | string[]): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const matchEnumParam = <T extends string>(
  value: string | undefined,
  enumValues: readonly T[],
): T | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  return enumValues.find((enumValue) => enumValue.toLowerCase() === normalized);
};

const buildVoiceOverrides = (
  params: PageSearchParams,
): VoiceOverrides | undefined => {
  const rawVoiceId =
    extractParam(params.voiceId) ?? extractParam(params.voice_id);
  const voiceId = rawVoiceId?.trim();

  const rawEmotion =
    extractParam(params.voiceEmotion) ?? extractParam(params.voice_emotion);
  const emotion = matchEnumParam(rawEmotion, Object.values(VoiceEmotion));

  const rawModel =
    extractParam(params.voiceModel) ?? extractParam(params.voice_model);
  const model = matchEnumParam(rawModel, Object.values(ElevenLabsModel));

  const overrides: VoiceOverrides = {};

  if (voiceId) {
    overrides.voiceId = voiceId;
  }

  if (emotion) {
    overrides.emotion = emotion;
  }

  if (model) {
    overrides.model = model;
  }

  return Object.keys(overrides).length > 0 ? overrides : undefined;
};

export default async function App({ searchParams }: PageProps) {
  const resolvedSearchParams =
    (searchParams ? await searchParams : undefined) ?? {};
  const rawExpert = extractParam(resolvedSearchParams.expert);
  const selectedExpert = resolveExpert(rawExpert);
  const expertPreset = AVATAR_PRESETS[selectedExpert];
  const rawSystemPrompt =
    extractParam(resolvedSearchParams.systemPrompt) ??
    extractParam(resolvedSearchParams.system_prompt);
  const systemPrompt =
    rawSystemPrompt?.trim() ?? expertPreset.systemPrompt?.trim();
  const rawAvatarId =
    extractParam(resolvedSearchParams.avatarId) ??
    extractParam(resolvedSearchParams.avatar_id);
  const avatarId = rawAvatarId?.trim() ?? expertPreset.avatarId?.trim();
  const queryVoiceOverrides = buildVoiceOverrides(resolvedSearchParams);
  const voiceOverrides = queryVoiceOverrides
    ? {
        ...(expertPreset.voiceOverrides ?? {}),
        ...queryVoiceOverrides,
      }
    : expertPreset.voiceOverrides
      ? { ...expertPreset.voiceOverrides }
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-4 py-6">
      <InteractiveAvatar
        avatarId={avatarId}
        expertName={selectedExpert}
        systemPrompt={systemPrompt}
        voiceOverrides={voiceOverrides}
      />
    </div>
  );
}
