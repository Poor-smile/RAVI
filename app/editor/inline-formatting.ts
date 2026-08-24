export type InlineFormattingEdit = {
  from: number;
  to: number;
  insert: string;
  selectionFrom: number;
  selectionTo: number;
};

const INLINE_WRAPPERS = [
  { open: "<u>", close: "</u>" },
  { open: "**", close: "**" },
  { open: "__", close: "__" },
  { open: "~~", close: "~~" },
  { open: "`", close: "`" },
  { open: "_", close: "_" },
  { open: "*", close: "*" },
] as const;

function stripOuterFormatting(value: string) {
  let current = value;
  let changed = true;
  while (changed) {
    changed = false;
    const link = /^\[([\s\S]*)\]\([^\n)]*\)$/u.exec(current);
    if (link) {
      current = link[1];
      changed = true;
      continue;
    }
    for (const wrapper of INLINE_WRAPPERS) {
      if (
        current.length >= wrapper.open.length + wrapper.close.length &&
        current.startsWith(wrapper.open) &&
        current.endsWith(wrapper.close)
      ) {
        current = current.slice(wrapper.open.length, -wrapper.close.length);
        changed = true;
        break;
      }
    }
  }
  return current;
}

export function clearInlineFormatting(
  source: string,
  selectionFrom: number,
  selectionTo: number,
): InlineFormattingEdit | null {
  let from = Math.max(0, Math.min(selectionFrom, source.length));
  let to = Math.max(from, Math.min(selectionTo, source.length));
  if (from === to) return null;

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const wrapper of INLINE_WRAPPERS) {
      if (
        from >= wrapper.open.length &&
        source.slice(from - wrapper.open.length, from) === wrapper.open &&
        source.slice(to, to + wrapper.close.length) === wrapper.close
      ) {
        from -= wrapper.open.length;
        to += wrapper.close.length;
        expanded = true;
        break;
      }
    }
    if (expanded) continue;

    if (from > 0 && source[from - 1] === "[" && source[to] === "]") {
      const destination = /^\]\([^\n)]*\)/u.exec(source.slice(to));
      if (destination) {
        from -= 1;
        to += destination[0].length;
        expanded = true;
      }
    }
  }

  let insert = stripOuterFormatting(source.slice(from, to));
  insert = insert
    .replace(/<u>([\s\S]*?)<\/u>/giu, "$1")
    .replace(/\[([^\]\n]+)\]\([^\n)]*\)/gu, "$1")
    .replace(/(\*\*|__|~~)(?=\S)([\s\S]*?\S)\1/gu, "$2")
    .replace(/([*_`])(?=\S)([^\n]*?\S)\1/gu, "$2");

  return {
    from,
    to,
    insert,
    selectionFrom: from,
    selectionTo: from + insert.length,
  };
}
