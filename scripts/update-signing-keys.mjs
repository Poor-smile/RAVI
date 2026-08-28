import { generateKeyPairSync } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export async function ensureUpdateSigningKeys(projectRoot) {
  const privateKeyPath =
    process.env.RAAVI_UPDATE_PRIVATE_KEY_PATH ||
    path.join(os.homedir(), ".raavi-release", "update-private-key.pem");
  const publicKeyPath = path.join(projectRoot, "build", "update-public-key.pem");
  await mkdir(path.dirname(privateKeyPath), { recursive: true });
  await mkdir(path.dirname(publicKeyPath), { recursive: true });
  try {
    await access(privateKeyPath);
    await access(publicKeyPath);
  } catch {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    await writeFile(
      privateKeyPath,
      privateKey.export({ type: "pkcs8", format: "pem" }),
      { mode: 0o600 },
    );
    await writeFile(
      publicKeyPath,
      publicKey.export({ type: "spki", format: "pem" }),
    );
  }
  return { privateKeyPath, publicKeyPath };
}
