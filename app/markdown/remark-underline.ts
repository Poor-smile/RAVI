type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
  data?: { hName?: string };
};

function transformChildren(parent: MarkdownNode) {
  if (!parent.children) return;
  for (const child of parent.children) transformChildren(child);

  const next: MarkdownNode[] = [];
  for (let index = 0; index < parent.children.length; index += 1) {
    const child = parent.children[index];
    if (child.type !== "html" || child.value?.trim().toLowerCase() !== "<u>") {
      next.push(child);
      continue;
    }

    const closingIndex = parent.children.findIndex(
      (candidate, candidateIndex) =>
        candidateIndex > index &&
        candidate.type === "html" &&
        candidate.value?.trim().toLowerCase() === "</u>",
    );
    if (closingIndex < 0) {
      next.push(child);
      continue;
    }

    next.push({
      type: "underline",
      data: { hName: "u" },
      children: parent.children.slice(index + 1, closingIndex),
    });
    index = closingIndex;
  }
  parent.children = next;
}

export default function remarkUnderline() {
  return (tree: MarkdownNode) => transformChildren(tree);
}
