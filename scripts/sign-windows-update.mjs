import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { updateSignaturePayload, validateUpdateManifest, verifyDownloadedUpdate } from "../desktop/software-update.mjs";

const [installerArgument, outputArgument] = process.argv.slice(2);
if (!installerArgument || !outputArgument) throw new Error("Usage: node scripts/sign-windows-update.mjs INSTALLER OUTPUT_JSON");
const root = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const installer = path.resolve(installerArgument);
if (path.basename(installer) !== `Raavi-Setup-${version}-x64.exe`) throw new Error("Installer filename does not match the release version.");
const keyPath = process.env.RAAVI_UPDATE_PRIVATE_KEY_PATH || path.join(os.homedir(), ".raavi-release", "update-private-key.pem");
// Signing never creates or rotates a release key.
const privateKey = createPrivateKey(await readFile(keyPath));
const publicKey = createPublicKey(await readFile(path.join(root, "build", "update-public-key.pem")));
if (!createPublicKey(privateKey).export({ type: "spki", format: "der" }).equals(publicKey.export({ type: "spki", format: "der" }))) throw new Error("Release private/public key mismatch.");
const sha512 = createHash("sha512");
for await (const chunk of createReadStream(installer)) sha512.update(chunk);
const artifact = {
  platform: "win32", arch: "x64",
  path: `/raavi/stable/${version}/${path.basename(installer)}`,
  size: (await stat(installer)).size,
  sha512: sha512.digest("hex"), signature: "",
};
artifact.signature = sign(null, updateSignaturePayload({ schema: 2, version, artifact }), privateKey).toString("base64");
const legacyArtifact = { path: artifact.path, size: artifact.size, sha512: artifact.sha512, signature: "" };
legacyArtifact.signature = sign(null, updateSignaturePayload({ schema: 1, version, artifact: legacyArtifact }), privateKey).toString("base64");
const manifest = {
  schema: 2, channel: "stable", version, publishedAt: new Date().toISOString(),
  artifact: legacyArtifact, artifacts: { "win32-x64": artifact },
  mirrors: [{ id: "primary", baseUrl: "https://dl2.gptt.ir" }],
};
for (const candidate of [manifest, { ...manifest, schema: 1, artifacts: undefined }]) {
  await verifyDownloadedUpdate({ filePath: installer, manifest: validateUpdateManifest(candidate, { platform: "win32", arch: "x64" }), publicKey });
}
const output = path.resolve(outputArgument);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({ version, installer, output, sha512: artifact.sha512, verifiedSchemas: [1, 2], scope: "Windows candidate only; Ed25519 update signature, not Windows Authenticode; not published" }, null, 2));
