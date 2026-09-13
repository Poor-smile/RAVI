/** Keep unchanged text readable; mark only the changed phrase in each version. */
export function changedPhrase(original: string, replacement: string) {
  let start = 0;
  while (start < original.length && start < replacement.length && original[start] === replacement[start]) start++;
  if (start === original.length && start === replacement.length) return { prefix: original, removed: "", added: "", suffix: "" };
  while (start > 0 && !/\s/u.test(original[start - 1])) start--;
  let suffix = 0;
  while (suffix < original.length - start && suffix < replacement.length - start && original.at(-suffix - 1) === replacement.at(-suffix - 1)) suffix++;
  while (suffix > 0 && !/\s/u.test(original[original.length - suffix])) suffix--;
  return { prefix: original.slice(0, start), removed: original.slice(start, original.length - suffix),
    added: replacement.slice(start, replacement.length - suffix), suffix: suffix ? original.slice(-suffix) : "" };
}
