type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName?: string };
};

const SKIP_PARENTS = new Set(["code", "inlineCode", "html"]);

function isHtmlComment(node: MarkdownNode) {
  return node.type === "html" && /^\s*<!--[\s\S]*-->\s*$/u.test(node.value ?? "");
}

function escapedAt(value: string, index: number) {
  let slashes = 0;
  for (let position = index - 1; position >= 0 && value[position] === "\\"; position -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

export function splitHighlightText(value: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const expression = /==(?=\S)(.+?\S)==/gu;
  let cursor = 0;
  for (const match of value.matchAll(expression)) {
    const index = match.index ?? 0;
    if (escapedAt(value, index)) continue;
    if (index > cursor) {
      nodes.push({ type: "text", value: value.slice(cursor, index) });
    }
    nodes.push({
      type: "highlight",
      data: { hName: "mark" },
      children: [{ type: "text", value: match[1] }],
    });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) {
    nodes.push({ type: "text", value: value.slice(cursor) });
  }
  return nodes.length ? nodes : [{ type: "text", value }];
}

function transformChildren(parent: MarkdownNode) {
  if (!parent.children || SKIP_PARENTS.has(parent.type)) return;
  const next: MarkdownNode[] = [];
  for (const child of parent.children) {
    if (isHtmlComment(child)) {
      continue;
    } else if (child.type === "text" && child.value?.includes("==")) {
      next.push(...splitHighlightText(child.value));
    } else {
      transformChildren(child);
      next.push(child);
    }
  }
  parent.children = next;
}

export default function remarkHighlight() {
  return (tree: MarkdownNode) => transformChildren(tree);
}
