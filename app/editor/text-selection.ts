const mixedScriptWordCharacter = /[\p{L}\p{M}\p{N}_\u200c\u200d]/u;

export type TextSelectionRange = {
  from: number;
  to: number;
};

/**
 * Resolve one logical token across adjacent RTL/LTR script runs.
 * Native double-click selection commonly stops at a bidi boundary even when
 * the author typed the value as one token (for example: فارسیEnglish).
 */
export function mixedScriptWordRangeAt(
  source: string,
  position: number,
  from = 0,
  to = source.length,
): TextSelectionRange | null {
  const boundedFrom = Math.max(0, Math.min(from, source.length));
  const boundedTo = Math.max(boundedFrom, Math.min(to, source.length));
  let probe = Math.max(boundedFrom, Math.min(position, boundedTo));
  if (
    probe === boundedTo ||
    !mixedScriptWordCharacter.test(source.slice(probe, probe + 1))
  ) {
    probe -= 1;
  }
  if (
    probe < boundedFrom ||
    !mixedScriptWordCharacter.test(source.slice(probe, probe + 1))
  ) {
    return null;
  }

  let wordFrom = probe;
  let wordTo = probe + 1;
  while (
    wordFrom > boundedFrom &&
    mixedScriptWordCharacter.test(source.slice(wordFrom - 1, wordFrom))
  ) {
    wordFrom -= 1;
  }
  while (
    wordTo < boundedTo &&
    mixedScriptWordCharacter.test(source.slice(wordTo, wordTo + 1))
  ) {
    wordTo += 1;
  }
  return wordFrom < wordTo ? { from: wordFrom, to: wordTo } : null;
}
