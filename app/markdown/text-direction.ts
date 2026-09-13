export type TextDirection = "ltr" | "rtl";

export const LATIN_DIRECTION_THRESHOLD = 0.7;

const LATIN_SCRIPT = /\p{Script=Latin}/u;
const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const LETTER = /\p{Letter}/u;

export function countDirectionalLetters(value: string) {
  let latin = 0;
  let arabic = 0;

  for (const character of value) {
    if (!LETTER.test(character)) continue;
    if (ARABIC_SCRIPT.test(character)) arabic += 1;
    else if (LATIN_SCRIPT.test(character)) latin += 1;
  }

  return { latin, arabic };
}

export function detectDocumentTextDirection(
  markdown: string,
  fallback: TextDirection = "rtl",
): TextDirection {
  // Document direction only needs presence, unlike the 70% block rule.
  // Intersect Script and Letter so Arabic numerals/marks remain neutral.
  if (/(?=\p{Script=Arabic})\p{Letter}/u.test(markdown)) return "rtl";
  return /(?=\p{Script=Latin})\p{Letter}/u.test(markdown) ? "ltr" : fallback;
}

export function detectBlockTextDirection(
  value: string,
  documentDirection: TextDirection = "rtl",
): TextDirection {
  if (documentDirection === "ltr") return "ltr";

  const { latin, arabic } = countDirectionalLetters(value);
  const directionalLetterCount = latin + arabic;
  if (directionalLetterCount === 0) return "rtl";

  return latin / directionalLetterCount > LATIN_DIRECTION_THRESHOLD
    ? "ltr"
    : "rtl";
}
