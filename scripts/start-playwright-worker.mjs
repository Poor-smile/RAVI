import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const portFlagIndex = process.argv.indexOf("--port");
const port = portFlagIndex >= 0 ? Number(process.argv[portFlagIndex + 1]) : 3137;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(`Invalid Playwright Worker port: ${process.argv[portFlagIndex + 1]}`);
}

const buildMarker = path.join(projectRoot, "dist", "server", "wrangler.json");
const sourceRoots = ["app", "build", "public", "worker"];
const sourceFiles = [
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  path.join(".openai", "hosting.json"),
];

async function newestMtime(target) {
  const targetStat = await stat(target);
  if (!targetStat.isDirectory()) return targetStat.mtimeMs;

  let newest = targetStat.mtimeMs;
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const entryPath = path.join(target, entry.name);
    newest = Math.max(newest, await newestMtime(entryPath));
  }
  return newest;
}

async function buildIsFresh() {
  let buildTime;
  try {
    buildTime = (await stat(buildMarker)).mtimeMs;
  } catch {
    return false;
  }

  const inputs = [
    ...sourceRoots.map((entry) => path.join(projectRoot, entry)),
    ...sourceFiles.map((entry) => path.join(projectRoot, entry)),
  ];
  for (const input of inputs) {
    try {
      if ((await newestMtime(input)) > buildTime) return false;
    } catch {
      // Optional inputs do not invalidate an otherwise complete build.
    }
  }
  return true;
}

function run(command, args, { keepAlive = false } = {}) {
  return new Promise((resolve, reject) => {
    const npmCli = process.env.npm_execpath;
    const useNodeCli =
      process.platform === "win32" &&
      Boolean(npmCli) &&
      (command === "npm" || command === "npx");
    const executable = useNodeCli ? process.execPath : command;
    const executableArgs = useNodeCli
      ? [
          command === "npx"
            ? path.join(path.dirname(npmCli), "npx-cli.js")
            : npmCli,
          ...args,
        ]
      : args;
    const child = spawn(executable, executableArgs, {
      cwd: projectRoot,
      env: process.env,
      shell: false,
      stdio: "inherit",
    });

    if (keepAlive) {
      const forward = (signal) => {
        if (!child.killed) child.kill(signal);
      };
      process.once("SIGINT", forward);
      process.once("SIGTERM", forward);
    }

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) return reject(new Error(`${executable} stopped with ${signal}`));
      if (code === 0) return resolve();
      reject(new Error(`${executable} exited with ${code ?? "unknown"}`));
    });
  });
}

if (!(await buildIsFresh())) {
  console.log("[playwright-worker] Production build is stale; rebuilding once.");
  await run("npm", ["run", "build"]);
} else {
  console.log("[playwright-worker] Reusing the fresh production build.");
}

await run(
  "npx",
  [
    "wrangler",
    "dev",
    "--config",
    "dist/server/wrangler.json",
    "--port",
    String(port),
    "--local",
  ],
  { keepAlive: true },
);
