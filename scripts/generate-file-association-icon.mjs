import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const buildDirectory = path.join(projectRoot, "build");
const tauriCli = path.join(projectRoot, "node_modules", "@tauri-apps", "cli", "tauri.js");

const markdownSvg = await readFile(path.join(buildDirectory, "file-icon-md.svg"), "utf8");
const encode = (value) => Buffer.from(value).toString("base64");

const composition = Buffer.from(`
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="paper" x1="90" y1="40" x2="610" y2="790" gradientUnits="userSpaceOnUse">
        <stop stop-color="#61C8E7"/><stop offset="0.38" stop-color="#5167DA"/><stop offset="1" stop-color="#D55BEA"/>
      </linearGradient>
      <linearGradient id="fold" x1="455" y1="0" x2="625" y2="255" gradientUnits="userSpaceOnUse">
        <stop stop-color="#FF9B78"/><stop offset="1" stop-color="#D55BEA"/>
      </linearGradient>
      <filter id="foldShadow" x="360" y="-20" width="330" height="330" filterUnits="userSpaceOnUse">
        <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#25356F" flood-opacity="0.45"/>
      </filter>
    </defs>
    <g transform="translate(135 54) scale(1.1407)">
      <path d="M18.5906 807.415C30.9844 819.805 45.4437 826 61.9688 826H599.031C615.556 826 630.016 819.805 642.409 807.415C654.803 795.025 661 780.57 661 764.05V226.117L434.814 0H61.9688C45.4437 0 30.9844 6.195 18.5906 18.585C6.19688 30.975 0 45.43 0 61.95V764.05C0 780.57 6.19688 795.025 18.5906 807.415Z" fill="url(#paper)"/>
      <path d="M401 0V250.5H661V225.5L435.5 0H401Z" fill="url(#fold)" filter="url(#foldShadow)"/>
      <image href="data:image/svg+xml;base64,${encode(markdownSvg)}" x="167.895" y="573" width="443.774" height="209.5"/>
    </g>
  </svg>
`);

const masterPath = path.join(buildDirectory, "file-icon.png");
await sharp(composition, { density: 192 }).resize(1024, 1024).png().toFile(masterPath);

const corners = await sharp(masterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = corners.info;
const offsets = [0, (width - 1) * channels, (height - 1) * width * channels, (width * height - 1) * channels];
if (offsets.some((offset) => corners.data[offset + 3] !== 0)) {
  throw new Error("The Markdown file icon must keep transparent corners.");
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "raavi-file-icon-"));
try {
  const result = spawnSync(process.execPath, [tauriCli, "icon", masterPath, "-o", temporaryDirectory], {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("File icon generation failed.");
  await Promise.all([
    copyFile(path.join(temporaryDirectory, "icon.ico"), path.join(buildDirectory, "file-icon.ico")),
    copyFile(path.join(temporaryDirectory, "icon.icns"), path.join(buildDirectory, "file-icon.icns")),
  ]);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Markdown file association icons for Windows and macOS generated from the approved Brand Identity sketch.");
