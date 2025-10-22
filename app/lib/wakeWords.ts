export const normalizeWakeWord = (
  value?: string | null,
): string | undefined => {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed.toLowerCase() : undefined;
};

const DELIMITER_PATTERN = /[|,]/g;

export const expandWakeWordValue = (value?: string | string[]): string[] => {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values
    .flatMap((entry) =>
      entry
        .split(DELIMITER_PATTERN)
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
    )
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const buildNormalizedWakeWordList = (
  wakeWord?: string,
  additionalWords: string[] = [],
): string[] => {
  const normalized = new Set<string>();
  const primary = normalizeWakeWord(wakeWord);

  if (primary) {
    normalized.add(primary);
  }

  additionalWords.forEach((word) => {
    const normalizedWord = normalizeWakeWord(word);

    if (normalizedWord) {
      normalized.add(normalizedWord);
    }
  });

  return Array.from(normalized);
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const findMatchingWakeWord = (
  input: string,
  normalizedWakeWords: string[],
): string | null => {
  if (!input.trim() || normalizedWakeWords.length === 0) {
    return null;
  }

  const normalizedInput = input.toLowerCase();

  for (const wakeWord of normalizedWakeWords) {
    if (!wakeWord) {
      continue;
    }

    const pattern = new RegExp(`\\b${escapeRegExp(wakeWord)}\\b`);

    if (pattern.test(normalizedInput)) {
      return wakeWord;
    }
  }

  return null;
};
