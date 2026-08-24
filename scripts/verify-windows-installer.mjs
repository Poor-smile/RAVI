import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const workspace = process.cwd();
const packagePath = path.join(workspace, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
const version = packageJson.version;
const releaseDirectoryArgument = process.argv[2] ?? "release";
const releaseDir = path.resolve(workspace, releaseDirectoryArgument);

const artifacts = {
  installer: path.join(releaseDir, `Raavi-Setup-${version}-x64.exe`),
  blockmap: path.join(releaseDir, `Raavi-Setup-${version}-x64.exe.blockmap`),
  executable: path.join(releaseDir, "win-unpacked", "Raavi.exe"),
  asar: path.join(releaseDir, "win-unpacked", "resources", "app.asar"),
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function inspectArtifact(label, filePath, minimumBytes, requirePe = false) {
  const info = await stat(filePath);
  assert(info.isFile(), `${label} is not a file: ${filePath}`);
  assert(info.size >= minimumBytes, `${label} is unexpectedly small: ${info.size} bytes`);

  const content = await readFile(filePath);
  if (requirePe) {
    assert(content[0] === 0x4d && content[1] === 0x5a, `${label} is not a Windows PE executable`);
  }

  return {
    path: path.relative(workspace, filePath),
    bytes: info.size,
    sha256: createHash("sha256").update(content).digest("hex").toUpperCase(),
  };
}

const build = packageJson.build;
assert(build?.appId === "ir.raavi.markdown", "Stable Windows upgrade identity (build.appId) changed");
assert(build?.executableName === "Raavi", "Windows executableName must remain Raavi");
assert(build?.nsis?.oneClick === false, "Windows installer must remain assisted");
assert(build?.nsis?.perMachine === true, "Windows installer must remain per-machine");
assert(build?.nsis?.allowToChangeInstallationDirectory === true, "Install directory selection is required");
assert(build?.nsis?.createDesktopShortcut === true, "Desktop shortcut is required");
assert(build?.nsis?.createStartMenuShortcut === true, "Start menu shortcut is required");

const markdownAssociation = (build?.fileAssociations ?? []).find((association) => {
  const extensions = Array.isArray(association.ext) ? association.ext : [association.ext];
  return extensions.map(String).includes("md");
});
assert(
  markdownAssociation?.icon === "build/file-icon.ico",
  "Markdown associations must use the dedicated Raavi file icon",
);
const fileIconPath = path.join(workspace, "build", "file-icon.ico");
const fileIcon = await readFile(fileIconPath);
assert(fileIcon.length >= 10_000, "Markdown file icon is unexpectedly small");
assert(
  fileIcon[0] === 0 && fileIcon[1] === 0 && fileIcon[2] === 1 && fileIcon[3] === 0,
  "Markdown file icon is not a valid Windows ICO container",
);
assert(fileIcon.readUInt16LE(4) >= 4, "Markdown file icon must contain multiple Windows sizes");

const expectedAssociations = new Map([
  ["md", "Raavi.Markdown"],
  ["markdown", "Raavi.Markdown"],
]);
const configuredAssociations = new Map();
for (const association of build?.fileAssociations ?? []) {
  const extensions = Array.isArray(association.ext) ? association.ext : [association.ext];
  for (const extension of extensions) {
    configuredAssociations.set(String(extension).replace(/^\./u, ""), association.name);
  }
}
for (const [extension, className] of expectedAssociations) {
  assert(
    configuredAssociations.get(extension) === className,
    `Missing or invalid .${extension} association (${className})`,
  );
}
assert(
  !configuredAssociations.has("ravi"),
  "Legacy document format must not be registered by the installer",
);

const builderDebug = await readFile(path.join(releaseDir, "builder-debug.yml"), "utf8");
for (const [extension, className] of expectedAssociations) {
  assert(
    builderDebug.includes(`APP_ASSOCIATE "${extension}" "${className}"`),
    `Generated NSIS script does not register .${extension}`,
  );
}
assert(
  !builderDebug.includes('APP_ASSOCIATE "ravi"'),
  "Generated NSIS script still registers the legacy document format",
);
assert(builderDebug.includes('WriteUninstaller "${UNINSTALLER_OUT_FILE}"'), "Generated NSIS script has no uninstaller");
assert(builderDebug.includes('!include "uninstaller.nsh"'), "Generated NSIS script does not include uninstaller logic");
assert(builderDebug.includes("silent upgrade of a per-machine installation"), "Generated NSIS script lacks upgrade handling");

const nsisTarget = await readFile(
  path.join(workspace, "node_modules", "app-builder-lib", "out", "targets", "nsis", "NsisTarget.js"),
  "utf8",
);
assert(nsisTarget.includes('insertMacro("APP_UNASSOCIATE"'), "Packager cannot remove file associations on uninstall");
assert(nsisTarget.includes('macro("unregisterFileAssociations"'), "Packager does not emit uninstall association cleanup");

const desktopMain = await readFile(path.join(workspace, "desktop", "main.mjs"), "utf8");
for (const marker of ["requestSingleInstanceLock", 'app.on("second-instance"', 'app.on("open-file"']) {
  assert(desktopMain.includes(marker), `Desktop file-open lifecycle is missing ${marker}`);
}

const results = {
  version,
  identity: build.appId,
  associations: Object.fromEntries(expectedAssociations),
  associationIcon: {
    path: path.relative(workspace, fileIconPath),
    bytes: fileIcon.length,
    entries: fileIcon.readUInt16LE(4),
  },
  artifacts: {
    installer: await inspectArtifact("Installer", artifacts.installer, 50_000_000, true),
    blockmap: await inspectArtifact("Blockmap", artifacts.blockmap, 1_000),
    executable: await inspectArtifact("Packaged executable", artifacts.executable, 50_000_000, true),
    asar: await inspectArtifact("Application archive", artifacts.asar, 1_000_000),
  },
};

console.log(JSON.stringify(results, null, 2));
console.log("Windows installer contract: PASS");
