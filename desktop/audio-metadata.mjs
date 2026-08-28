import { parseFile } from "music-metadata";

export async function readAudioMetadataDuration(filePath) {
  const metadata = await parseFile(filePath, {
    duration: true,
    skipCovers: true,
  });
  const durationSeconds = Number(metadata.format.duration);
  if (
    metadata.format.hasAudio === false ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    throw new Error("مدت یا سلامت فایل صوتی قابل تشخیص نیست.");
  }
  return Math.round(durationSeconds * 1000);
}
