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
const releaseRoot = path.join(projectRoot, "release");
const windowsArtifactName = `Raavi-Setup-${version}-x64.exe`;
const windowsArtifactPath = path.join(releaseRoot, windowsArtifactName);
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

async function firstExisting(candidates, errorCode) {
  for (const candidate of candidates.filter(Boolean)) {
    const resolved = path.resolve(candidate);
    try {
      await access(resolved);
      return resolved;
    } catch {
      // Try the next approved release artifact name.
    }
  }
  throw new Error(errorCode);
}

const macArm64ArtifactPath = await firstExisting(
  [
    process.env.RAAVI_MAC_ARM64_ARTIFACT,
    path.join(releaseRoot, `Raavi-${version}-macOS-arm64.dmg`),
    path.join(releaseRoot, `Raavi-${version}-macOS-arm64-unsigned.dmg`),
  ],
  "Missing macOS arm64 DMG. Download the asset from the matching GitHub Release first.",
);
const macX64ArtifactPath = await firstExisting(
  [
    process.env.RAAVI_MAC_X64_ARTIFACT,
    path.join(releaseRoot, `Raavi-${version}-macOS-x64.dmg`),
    path.join(releaseRoot, `Raavi-${version}-macOS-x64-unsigned.dmg`),
  ],
  "Missing macOS x64 DMG. Download the asset from the matching GitHub Release first.",
);

await access(windowsArtifactPath);
const { privateKeyPath } = await ensureUpdateSigningKeys(projectRoot);
const privateKey = await readFile(privateKeyPath);

async function artifactMetadata({ sourcePath, platform, arch }) {
  const artifactStat = await stat(sourcePath);
  const hash = createHash("sha512");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(sourcePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return {
    platform,
    arch,
    path: `/raavi/stable/${version}/${path.basename(sourcePath)}`,
    size: artifactStat.size,
    sha512: hash.digest("hex"),
    signature: "",
  };
}

const artifactSources = {
  "win32-x64": windowsArtifactPath,
  "darwin-arm64": macArm64ArtifactPath,
  "darwin-x64": macX64ArtifactPath,
};
const artifacts = {};
for (const [key, sourcePath] of Object.entries(artifactSources)) {
  const [platform, arch] = key.split("-");
  const artifact = await artifactMetadata({ sourcePath, platform, arch });
  artifact.signature = sign(
    null,
    updateSignaturePayload({ schema: 2, version, artifact }),
    privateKey,
  ).toString("base64");
  artifacts[key] = artifact;
}

const legacyWindowsArtifact = {
  path: artifacts["win32-x64"].path,
  size: artifacts["win32-x64"].size,
  sha512: artifacts["win32-x64"].sha512,
  signature: "",
};
legacyWindowsArtifact.signature = sign(
  null,
  updateSignaturePayload({
    schema: 1,
    version,
    artifact: legacyWindowsArtifact,
  }),
  privateKey,
).toString("base64");

const manifest = {
  schema: 2,
  channel: "stable",
  version,
  publishedAt: new Date().toISOString(),
  notesUrl: `https://ravi.poorsmile.ir/updates/releases/${version}.json`,
  artifact: legacyWindowsArtifact,
  artifacts,
  mirrors: mirrorBaseUrls.map((baseUrl, index) => ({
    id: index === 0 ? "primary" : `mirror-${index + 1}`,
    baseUrl,
  })),
};

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
      artifacts: Object.fromEntries(
        Object.entries(artifacts).map(([key, artifact]) => [
          key,
          { size: artifact.size, path: artifact.path },
        ]),
      ),
    },
    null,
    2,
  )}\n`,
);
for (const sourcePath of Object.values(artifactSources)) {
  await copyFile(sourcePath, path.join(heavyRoot, path.basename(sourcePath)));
}

console.log(`Prepared update ${version}`);
console.log(`Lightweight: ${path.join(publishRoot, "lightweight")}`);
console.log(`Heavy: ${path.join(publishRoot, "heavy")}`);
