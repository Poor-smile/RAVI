import { copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const buildDirectory = path.join(projectRoot, "build");
const tauriCli = path.join(
  projectRoot,
  "node_modules",
  "@tauri-apps",
  "cli",
  "tauri.js",
);
const matte = [245, 245, 245];
const variants = [
  {
    name: "light",
    source: "icon-master.png",
    transparentMaster: "icon-master-transparent.png",
    outputPrefix: "icon",
    shadow: [20, 31, 61],
  },
  {
    name: "dark",
    source: "icon-dark-master.png",
    transparentMaster: "icon-dark-master-transparent.png",
    outputPrefix: "icon-dark",
    shadow: [0, 0, 0],
  },
];

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

async function makeTransparentMaster(variant) {
  const sourcePath = path.join(buildDirectory, variant.source);
  const outputPath = path.join(buildDirectory, variant.transparentMaster);
  const source = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = source.info;
  if (width !== 1024 || height !== 1024 || channels !== 4) {
    throw new Error(`${variant.source} must be a 1024px RGBA image.`);
  }

  const maskSvg = Buffer.from(`
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <rect x="64" y="64" width="896" height="896" rx="224" fill="#fff"/>
    </svg>
  `);
  const mask = await sharp(maskSvg)
    .resize(width, height)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const sourceOffset = index * channels;
    const outputOffset = index * 4;
    const shapeAlpha = mask.data[sourceOffset + 3] / 255;
    const sourceColor = [
      source.data[sourceOffset],
      source.data[sourceOffset + 1],
      source.data[sourceOffset + 2],
    ];
    const shadowRatios = sourceColor.map((channel, channelIndex) => {
      const denominator = matte[channelIndex] - variant.shadow[channelIndex];
      return denominator > 0
        ? Math.max(0, Math.min(1, (matte[channelIndex] - channel) / denominator))
        : 0;
    });
    const shadowAlpha =
      shadowRatios.reduce((sum, value) => sum + value, 0) /
      shadowRatios.length;

    if (shapeAlpha >= 0.999) {
      output[outputOffset] = sourceColor[0];
      output[outputOffset + 1] = sourceColor[1];
      output[outputOffset + 2] = sourceColor[2];
      output[outputOffset + 3] = 255;
      continue;
    }

    const recoveredShape = sourceColor.map((channel, channelIndex) =>
      shapeAlpha > 0.001
        ? clampByte(
            (channel - matte[channelIndex] * (1 - shapeAlpha)) / shapeAlpha,
          )
        : 0,
    );
    const effectiveShadowAlpha = shadowAlpha * (1 - shapeAlpha);
    const alpha = shapeAlpha + effectiveShadowAlpha;
    if (alpha <= 0.003) {
      output.fill(0, outputOffset, outputOffset + 4);
      continue;
    }

    for (let channelIndex = 0; channelIndex < 3; channelIndex += 1) {
      output[outputOffset + channelIndex] = clampByte(
        (recoveredShape[channelIndex] * shapeAlpha +
          variant.shadow[channelIndex] * effectiveShadowAlpha) /
          alpha,
      );
    }
    output[outputOffset + 3] = clampByte(alpha * 255);
  }

  await sharp(output, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(outputPath);
  return outputPath;
}

async function assertTransparentPng(buffer, label) {
  const image = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = image.info;
  const offsets = [
    0,
    (width - 1) * channels,
    (height - 1) * width * channels,
    (width * height - 1) * channels,
  ];
  if (offsets.some((offset) => image.data[offset + 3] !== 0)) {
    throw new Error(`${label} has an opaque corner.`);
  }
}

async function assertTransparentIco(filePath, label) {
  const ico = await import("node:fs/promises").then(({ readFile }) =>
    readFile(filePath),
  );
  const entryCount = ico.readUInt16LE(4);
  if (entryCount < 6) {
    throw new Error(`${label} is missing required Windows icon sizes.`);
  }
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = 6 + index * 16;
    const byteLength = ico.readUInt32LE(entryOffset + 8);
    const imageOffset = ico.readUInt32LE(entryOffset + 12);
    await assertTransparentPng(
      ico.subarray(imageOffset, imageOffset + byteLength),
      `${label} entry ${index + 1}`,
    );
  }
}

async function generateVariant(variant) {
  const transparentMaster = await makeTransparentMaster(variant);
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), `raavi-${variant.name}-icon-`),
  );
  try {
    const result = spawnSync(
      process.execPath,
      [tauriCli, "icon", transparentMaster, "-o", temporaryDirectory],
      { cwd: projectRoot, stdio: "inherit" },
    );
    if (result.status !== 0) {
      throw new Error(`Tauri icon generation failed for ${variant.name}.`);
    }

    const outputs = [
      ["icon.ico", `${variant.outputPrefix}.ico`],
      ["icon.png", `${variant.outputPrefix}.png`],
      ["icon.icns", `${variant.outputPrefix}.icns`],
    ];
    for (const [sourceName, destinationName] of outputs) {
      await copyFile(
        path.join(temporaryDirectory, sourceName),
        path.join(buildDirectory, destinationName),
      );
    }
    await assertTransparentIco(
      path.join(buildDirectory, `${variant.outputPrefix}.ico`),
      `${variant.outputPrefix}.ico`,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

for (const variant of variants) {
  await generateVariant(variant);
}

console.log("Raavi light and dark application icons now have transparent corners.");
