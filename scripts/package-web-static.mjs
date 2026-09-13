import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import worker from "../dist/server/index.js";
import { mobileEntryScript } from "./mobile-entry.mjs";

const projectRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const assetsRoot = join(projectRoot, "dist", "client");
const outputRoot = join(projectRoot, ".deploy-raavi-web");
const archivePath = join(projectRoot, "raavi-web-cpanel.zip");
const lightDirectory = process.env.RAAVI_LIGHT_DIST;

const mimeTypes = new Map([
  [".css", "text/css;charset=utf-8"],
  [".html", "text/html;charset=utf-8"],
  [".js", "text/javascript;charset=utf-8"],
  [".json", "application/json;charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

async function fetchAsset(request) {
  const url = new URL(request.url);
  const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const fullPath = normalize(join(assetsRoot, relativePath));
  if (!fullPath.startsWith(assetsRoot)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    return new Response(await readFile(fullPath), {
      headers: {
        "content-type": mimeTypes.get(extname(fullPath)) ?? "application/octet-stream",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function renderIndex() {
  const response = await worker.fetch(
    new Request("https://raviweb.poorsmile.ir/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: fetchAsset },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  if (!response.ok) {
    throw new Error(`Render failed with status ${response.status}`);
  }
  return response.text();
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      shell: process.platform === "win32",
      stdio: "inherit",
      ...options,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(assetsRoot, outputRoot, { recursive: true });
const { version } = JSON.parse(await readFile(join(projectRoot, "package.json"), "utf8"));
if (lightDirectory) {
  const manifest = JSON.parse(await readFile(join(lightDirectory, "manifest.webmanifest"), "utf8"));
  const manifestUrl = "https://raviweb.poorsmile.ir/light/manifest.webmanifest";
  if (new URL(manifest.scope, manifestUrl).pathname !== "/light/" || new URL(manifest.start_url, manifestUrl).pathname !== "/light/") {
    throw new Error("Light must be built with /light/ as its scope and start URL.");
  }
  await cp(lightDirectory, join(outputRoot, "light"), { recursive: true });
  await writeFile(join(outputRoot, "light", "version.json"), JSON.stringify({ version, product: "Ravi Light", base: "/light/" }) + "\n", "utf8");
}
const html = (await renderIndex()).replace("<head>", `<head><meta name="raavi-version" content="${version}"><script src="/mobile-entry.js?v=${version}"></script>`);
await writeFile(join(outputRoot, "index.html"), html, "utf8");
await writeFile(join(outputRoot, "mobile-entry.js"), mobileEntryScript, "utf8");
await writeFile(join(outputRoot, "version.json"), JSON.stringify({ version, builtAt: new Date().toISOString(), mobilePath: "/light/" }) + "\n", "utf8");
await writeFile(
  join(outputRoot, ".htaccess"),
  [
    "DirectoryIndex index.html",
    "Options -Indexes",
    "ErrorDocument 404 default",
    "AddType text/javascript .js",
    "AddType font/woff2 .woff2",
    "<IfModule mod_headers.c>",
    'Header always set X-Content-Type-Options "nosniff"',
    'Header set Cache-Control "no-cache"',
    "</IfModule>",
    "<IfModule mod_rewrite.c>",
    "RewriteEngine On",
    "RewriteRule ^(?:assets/|light/|.*\\.(?:js|css|json|woff2?|ttf|png|svg|webp)$) - [L]",
    "RewriteCond %{REQUEST_FILENAME} !-f",
    "RewriteCond %{REQUEST_FILENAME} !-d",
    "RewriteRule ^ index.html [L]",
    "</IfModule>",
    "",
  ].join("\n"),
  "utf8",
);

await rm(join(outputRoot, ".vite"), { recursive: true, force: true });
await rm(archivePath, { force: true });
await run("python", [
  "scripts/write_zip.py",
  outputRoot,
  archivePath,
]);

const displayOutput = relative(projectRoot, outputRoot);
const displayArchive = relative(projectRoot, archivePath);
console.log(`Packaged ${displayOutput}`);
console.log(`Created ${displayArchive}`);
