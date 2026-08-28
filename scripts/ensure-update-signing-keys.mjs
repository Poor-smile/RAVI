import path from "node:path";
import { ensureUpdateSigningKeys } from "./update-signing-keys.mjs";

await ensureUpdateSigningKeys(path.resolve(import.meta.dirname, ".."));
console.log("Update signing key is ready.");
