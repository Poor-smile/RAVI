const PUNCTUATION = /[،؛,:;.!؟!?]/u;

export function speechWordCount(text) {
  return String(text ?? "").trim().split(/\s+/u).filter(Boolean).length;
}

export function minimumSpeechDurationMs(text, speed = 1) {
  const value = String(text ?? "").replace(/[\u064b-\u065f\u0670]/gu, "").trim();
  const words = speechWordCount(value);
  const letters = value.replace(/\s|[،؛,:;.!؟!?]/gu, "").length;
  const rate = Math.max(0.5, Math.min(2, Number(speed) || 1));
  return Math.round(Math.max(320, words * 145, letters * 18) / rate);
}

export function audioMetadataLooksComplete(text, speed, metadata) {
  const duration = Number(metadata?.speechDurationMs ?? metadata?.durationMs ?? 0);
  const frames = Number(metadata?.frames ?? 0);
  const sampleRate = Number(metadata?.sampleRate ?? 0);
  return frames > 0 && sampleRate >= 8_000 && duration >= minimumSpeechDurationMs(text, speed);
}

export function shouldPreSplitSpeech(engine, text) {
  const value = String(text ?? "").trim();
  if (engine === "ava") return value.length > 125 || speechWordCount(value) > 16;
  if (engine === "gooya") return value.length > 105 || speechWordCount(value) > 14;
  if (engine === "f5ipa") return value.length > 110 || speechWordCount(value) > 15;
  return false;
}

export function splitSpeechForRetry(text) {
  const value = String(text ?? "").trim();
  if (!value) return [];
  const middle = Math.floor(value.length / 2);
  const minimum = Math.max(18, Math.floor(value.length * 0.28));
  const maximum = Math.min(value.length - 18, Math.ceil(value.length * 0.72));
  let splitAt = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = minimum; index <= maximum; index += 1) {
    if (!PUNCTUATION.test(value[index - 1] ?? "")) continue;
    const distance = Math.abs(index - middle);
    if (distance < bestDistance) {
      bestDistance = distance;
      splitAt = index;
    }
  }
  if (splitAt < 0) {
    for (let distance = 0; distance <= Math.max(middle - minimum, maximum - middle); distance += 1) {
      const before = middle - distance;
      const after = middle + distance;
      if (before >= minimum && /\s/u.test(value[before] ?? "")) {
        splitAt = before + 1;
        break;
      }
      if (after <= maximum && /\s/u.test(value[after] ?? "")) {
        splitAt = after + 1;
        break;
      }
    }
  }
  if (splitAt <= 0 || splitAt >= value.length) return [value];
  const first = value.slice(0, splitAt).trim();
  const second = value.slice(splitAt).trim();
  return first && second ? [first, second] : [value];
}
