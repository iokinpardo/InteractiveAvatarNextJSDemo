import { ElevenLabsModel, VoiceEmotion } from "@heygen/streaming-avatar";

import InteractiveAvatar, {
  type VoiceOverrides,
} from "@/components/InteractiveAvatar";
import { FilePdfIcon } from "@/components/Icons";
import { AVATAR_PRESETS, resolveExpert } from "@/app/lib/avatarPresets";

const DOCUMENTATION_LINK =
  "https://www.antennahouse.com/hubfs/xsl-fo-sample/pdf/basic-link-1.pdf";

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
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
      <aside className="flex w-full flex-col gap-4 rounded-3xl bg-zinc-900/70 p-6 text-zinc-100 shadow-lg lg:w-64">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Documentation
        </h2>
        <a
          className="flex items-center gap-3 rounded-2xl border border-zinc-800/60 bg-zinc-900/60 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-900"
          href={DOCUMENTATION_LINK}
          rel="noopener noreferrer"
          target="_blank"
        >
          <FilePdfIcon className="h-6 w-6 text-red-400" />
          <span>Basic report</span>
        </a>
        <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 px-4 py-3 text-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Active expert preset
          </p>
          <p className="text-xs text-zinc-300">{selectedExpert}</p>
        </div>
        {systemPrompt ? (
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 px-4 py-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Active system prompt
            </p>
            <p className="mb-2 text-xs text-zinc-400">
              Forwarded to HeyGen as the custom knowledge base for this session.
            </p>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-zinc-950/60 p-3 text-xs text-zinc-200">
              {systemPrompt}
            </pre>
          </div>
        ) : null}
        {avatarId ? (
          <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/60 px-4 py-3 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Active avatar ID
            </p>
            <p className="mb-2 text-xs text-zinc-400">
              Applied as the avatarName override for this session.
            </p>
            <code className="block rounded-xl bg-zinc-950/60 px-3 py-2 text-xs text-zinc-200">
              {avatarId}
            </code>
          </div>
        ) : null}
      </aside>
      <div className="flex w-full justify-center lg:justify-start">
        <InteractiveAvatar
          avatarId={avatarId}
          expertName={selectedExpert}
          systemPrompt={systemPrompt}
          voiceOverrides={voiceOverrides}
        />
      </div>
    </div>
  );
}
