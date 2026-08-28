import { createHash, sign } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { updateSignaturePayload } from "../desktop/software-update.mjs";
import { ensureUpdateSigningKeys } from "./update-signing-keys.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageMetadata = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const version = packageMetadata.version;
const artifactName = `Raavi-Setup-${version}-x64.exe`;
const artifactPath = path.join(projectRoot, "release", artifactName);
const publishRoot = path.join(projectRoot, "artifacts", "update-publish");
const mirrorBaseUrls = String(
  process.env.RAAVI_UPDATE_MIRRORS || "https://dl2.gptt.ir",
)
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);

for (const baseUrl of mirrorBaseUrls) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") {
    throw new Error(`Update mirror must use HTTPS: ${baseUrl}`);
  }
}

await access(artifactPath);
const { privateKeyPath } = await ensureUpdateSigningKeys(projectRoot);

const artifactStat = await stat(artifactPath);
const hash = createHash("sha512");
await new Promise((resolve, reject) => {
  const stream = createReadStream(artifactPath);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("error", reject);
  stream.on("end", resolve);
});
const sha512 = hash.digest("hex");
const remoteArtifactPath = `/raavi/stable/${version}/${artifactName}`;
const manifest = {
  schema: 1,
  channel: "stable",
  version,
  publishedAt: new Date().toISOString(),
  notesUrl: `https://ravi.poorsmile.ir/updates/releases/${version}.json`,
  artifact: {
    path: remoteArtifactPath,
    size: artifactStat.size,
    sha512,
    signature: "",
  },
  mirrors: mirrorBaseUrls.map((baseUrl, index) => ({
    id: index === 0 ? "primary" : `mirror-${index + 1}`,
    baseUrl,
  })),
};
const privateKey = await readFile(privateKeyPath);
manifest.artifact.signature = sign(
  null,
  updateSignaturePayload(manifest),
  privateKey,
).toString("base64");

const lightweightRoot = path.join(publishRoot, "lightweight", "updates");
const heavyRoot = path.join(
  publishRoot,
  "heavy",
  "raavi",
  "stable",
  version,
);
await mkdir(path.join(lightweightRoot, "releases"), { recursive: true });
await mkdir(heavyRoot, { recursive: true });
await writeFile(
  path.join(lightweightRoot, "stable.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  path.join(lightweightRoot, "releases", `${version}.json`),
  `${JSON.stringify(
    {
      version,
      title: `راوی ${version}`,
      summary: "بهبودهای پایداری، راه‌اندازی سریع‌تر و سیستم به‌روزرسانی امن داخلی.",
      publishedAt: manifest.publishedAt,
      size: artifactStat.size,
    },
    null,
    2,
  )}\n`,
);
await copyFile(artifactPath, path.join(heavyRoot, artifactName));

console.log(`Prepared update ${version}`);
console.log(`Lightweight: ${path.join(publishRoot, "lightweight")}`);
console.log(`Heavy: ${path.join(publishRoot, "heavy")}`);
