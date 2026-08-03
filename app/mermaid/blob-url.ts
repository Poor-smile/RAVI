export type MermaidBlobUrl = {
  url: string;
  revoke: () => void;
};

export function createMermaidBlobUrl(svg: string): MermaidBlobUrl | null {
  if (!svg || typeof URL.createObjectURL !== "function") return null;
  const url = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  let revoked = false;
  return {
    url,
    revoke: () => {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    },
  };
}
