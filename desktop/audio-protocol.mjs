import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const AUDIO_CONTENT_TYPES = new Map([
  [".aac", "audio/aac"],
  [".flac", "audio/flac"],
  [".m4a", "audio/mp4"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
  [".webm", "audio/webm"],
]);

function parseByteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/u.exec(String(value ?? "").trim());
  if (!match || size <= 0) return null;
  const [, startText, endText] = match;
  if (!startText && !endText) return null;

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= size
  ) {
    return null;
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export async function createAudioFileResponse(request, filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) return new Response("Audio asset not found", { status: 404 });

  const size = info.size;
  const contentType =
    AUDIO_CONTENT_TYPES.get(path.extname(filePath).toLocaleLowerCase("en-US")) ??
    "application/octet-stream";
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": contentType,
  });
  const rangeHeader = request.headers.get("range");
  const method = request.method.toUpperCase();

  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, size);
    if (!range) {
      headers.set("Content-Range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    const contentLength = range.end - range.start + 1;
    headers.set("Content-Length", String(contentLength));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
    if (method === "HEAD") return new Response(null, { status: 206, headers });
    const body = Readable.toWeb(
      createReadStream(filePath, { start: range.start, end: range.end }),
    );
    return new Response(body, { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  if (method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(Readable.toWeb(createReadStream(filePath)), {
    status: 200,
    headers,
  });
}

export const __audioProtocolTesting = { parseByteRange };
