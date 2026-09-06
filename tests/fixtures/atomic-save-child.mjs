import * as fs from "node:fs/promises";
import { createAtomicFileWriter } from "../../desktop/atomic-file.mjs";

const [target, stage] = process.argv.slice(2);
const stop = async () => {
  process.send("at-commit-boundary");
  setInterval(() => {}, 1_000);
  await new Promise(() => {});
};
await createAtomicFileWriter({ fs: {
  ...fs,
  rename: async (...args) => {
    if (stage === "before-rename") await stop();
    await fs.rename(...args);
    if (stage === "after-rename") await stop();
  },
} })(target, "complete replacement");
