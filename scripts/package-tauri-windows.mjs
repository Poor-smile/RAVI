import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import packageMetadata from "../package.json" with { type: "json" };

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const releaseDirectory = path.join(projectRoot, "release");
const targetDirectory = path.join(projectRoot, "src-tauri", "target", "release");
const nsisDirectory = path.join(targetDirectory, "bundle", "nsis");
const version = packageMetadata.version;

await mkdir(releaseDirectory, { recursive: true });

const installerName = (await readdir(nsisDirectory)).find(
  (name) =>
    name.toLowerCase().endsWith("_x64-setup.exe") &&
    name.includes(`_${version}_`),
);
if (!installerName) {
  throw new Error(`No Tauri NSIS installer was found in ${nsisDirectory}.`);
}

const artifacts = [
  {
    source: path.join(nsisDirectory, installerName),
    destination: path.join(
      releaseDirectory,
      `Raavi-Tauri-Setup-${version}-x64.exe`,
    ),
  },
  {
    source: path.join(targetDirectory, "raavi.exe"),
    destination: path.join(
      releaseDirectory,
      `Raavi-Tauri-Portable-${version}-x64.exe`,
    ),
  },
];

for (const artifact of artifacts) {
  await copyFile(artifact.source, artifact.destination);
  const details = await stat(artifact.destination);
  const size = (details.size / (1024 * 1024)).toFixed(2);
  console.log(`${path.basename(artifact.destination)}: ${size} MiB`);
}
