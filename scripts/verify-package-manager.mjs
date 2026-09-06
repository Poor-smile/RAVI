import { readFile } from "node:fs/promises";

const { packageManager } = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const expected = packageManager.replace("@", "/");
const actual = process.env.npm_config_user_agent?.split(" ")[0];
if (actual !== expected) {
  throw new Error(`Use ${packageManager} and npm ci. Received ${actual ?? "no package manager"}. package-lock.json is the only JavaScript dependency lock.`);
}
