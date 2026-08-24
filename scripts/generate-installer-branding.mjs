import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(projectRoot, "build");

function encodeBmp({ data, info }) {
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error("Expected RGBA installer artwork.");
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const output = Buffer.alloc(54 + pixelBytes);

  output.write("BM", 0, "ascii");
  output.writeUInt32LE(output.length, 2);
  output.writeUInt32LE(54, 10);
  output.writeUInt32LE(40, 14);
  output.writeInt32LE(width, 18);
  output.writeInt32LE(height, 22);
  output.writeUInt16LE(1, 26);
  output.writeUInt16LE(24, 28);
  output.writeUInt32LE(pixelBytes, 34);
  output.writeInt32LE(2835, 38);
  output.writeInt32LE(2835, 42);

  for (let y = 0; y < height; y += 1) {
    const sourceY = height - 1 - y;
    const destinationRow = 54 + y * rowSize;
    for (let x = 0; x < width; x += 1) {
      const source = (sourceY * width + x) * 4;
      const destination = destinationRow + x * 3;
      output[destination] = data[source + 2];
      output[destination + 1] = data[source + 1];
      output[destination + 2] = data[source];
    }
  }

  return output;
}

async function saveBmp(image, fileName) {
  const rendered = await image
    .flatten({ background: "#11131b" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  await writeFile(path.join(buildDirectory, fileName), encodeBmp(rendered));
}

function glassOverlay(width, height, dark = false) {
  const line = dark ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.52)";
  const shade = dark ? "rgba(5,8,18,.34)" : "rgba(23,22,42,.12)";
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
          <stop stop-color="${shade}"/>
          <stop offset=".58" stop-color="rgba(0,0,0,0)"/>
          <stop offset="1" stop-color="${dark ? "rgba(4,5,13,.42)" : "rgba(38,25,55,.16)"}"/>
        </linearGradient>
        <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <circle cx="${Math.round(width * 0.5)}" cy="${Math.round(height * 0.42)}" r="48" fill="rgba(255,255,255,.14)" filter="url(#glow)"/>
      ${[0.31, 0.43, 0.55, 0.67]
        .map(
          (position) =>
            `<rect x="17" y="${Math.round(height * position)}" width="${width - 34}" height="7" rx="3.5" fill="rgba(255,255,255,.10)" stroke="${line}" stroke-width=".7"/>`,
        )
        .join("")}
      <rect x="15" y="${height - 66}" width="${width - 30}" height="42" rx="13" fill="rgba(255,255,255,.10)" stroke="${line}" stroke-width=".7"/>
      <circle cx="35" cy="${height - 45}" r="4" fill="rgba(255,255,255,.82)"/>
      <rect x="47" y="${height - 48}" width="65" height="6" rx="3" fill="rgba(255,255,255,.54)"/>
    </svg>
  `);
}

async function createSidebar({ dark, output }) {
  const width = 164;
  const height = 314;
  const source = path.join(buildDirectory, "icon-android-background.png");
  const foreground = path.join(buildDirectory, "icon-android-foreground-transparent.png");
  const background = await sharp(source)
    .modulate({ brightness: dark ? 0.4 : 1, saturation: dark ? 0.82 : 1 })
    .resize(height, height, { fit: "cover" })
    .extract({ left: Math.floor((height - width) / 2), top: 0, width, height })
    .png()
    .toBuffer();
  const mark = await sharp(foreground)
    .resize(140, 140, { fit: "contain" })
    .png()
    .toBuffer();
  const image = sharp({ create: { width, height, channels: 4, background: "#11131b" } }).composite([
    { input: background, left: 0, top: 0 },
    { input: glassOverlay(width, height, dark), left: 0, top: 0 },
    { input: mark, left: 12, top: 48 },
  ]);
  await saveBmp(image.clone(), output);
  return image.png().toBuffer();
}

async function createHeader() {
  const width = 150;
  const height = 57;
  const background = await sharp(path.join(buildDirectory, "icon-android-background.png"))
    .resize(width, height, { fit: "cover" })
    .modulate({ brightness: 0.9, saturation: 0.9 })
    .png()
    .toBuffer();
  const foreground = await sharp(path.join(buildDirectory, "icon-android-foreground-transparent.png"))
    .resize(52, 52, { fit: "contain" })
    .png()
    .toBuffer();
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="rgba(18,18,34,.16)"/>
      <rect x="7" y="7" width="136" height="43" rx="14" fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.46)"/>
      <circle cx="26" cy="28.5" r="4" fill="rgba(255,255,255,.78)"/>
      <rect x="37" y="25.5" width="50" height="6" rx="3" fill="rgba(255,255,255,.46)"/>
    </svg>
  `);
  const image = sharp({ create: { width, height, channels: 4, background: "#11131b" } }).composite([
    { input: background, left: 0, top: 0 },
    { input: overlay, left: 0, top: 0 },
    { input: foreground, left: 94, top: 2 },
  ]);
  await saveBmp(image.clone(), "installerHeader.bmp");
  return image.png().toBuffer();
}

const lightSidebar = await createSidebar({ dark: false, output: "installerSidebar.bmp" });
const darkSidebar = await createSidebar({ dark: true, output: "uninstallerSidebar.bmp" });
const header = await createHeader();

const preview = await sharp({
  create: { width: 548, height: 388, channels: 4, background: "#e8ebe2" },
})
  .composite([
    { input: lightSidebar, left: 24, top: 24 },
    { input: darkSidebar, left: 212, top: 24 },
    { input: header, left: 392, top: 24 },
  ])
  .png()
  .toBuffer();

await writeFile(path.join(projectRoot, ".artifacts", "installer-branding-preview.png"), preview);

console.log("Raavi installer branding generated: sidebar, uninstaller sidebar, and header.");
