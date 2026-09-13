export function parseSavedContent(serialized: string) {
  try {
    const value = JSON.parse(serialized);
    if (typeof value?.content !== "string" || !Array.isArray(value.annotations) || !Array.isArray(value.assets)) return null;
    return { content: value.content as string, metadata: JSON.stringify({ annotations: value.annotations, assets: value.assets }) };
  } catch { return null; }
}

export function matchesSavedContent(saved: ReturnType<typeof parseSavedContent>, content: string, metadata: string) {
  return saved !== null && saved.content === content && saved.metadata === metadata;
}
