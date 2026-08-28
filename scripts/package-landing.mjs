import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const sourceRoot = join(projectRoot, "landing");
const outputRoot = join(projectRoot, ".deploy-raavi-publish");

const [html, css, javascript, markdown] = await Promise.all([
  readFile(join(sourceRoot, "index.html"), "utf8"),
  readFile(join(sourceRoot, "style.css"), "utf8"),
  readFile(join(sourceRoot, "app.js"), "utf8"),
  readFile(join(sourceRoot, "landing.md"), "utf8"),
]);

const embeddedMarkdown = JSON.stringify(markdown).replaceAll(
  "</script",
  "<\\/script",
);
const embeddedJavascript = javascript.replaceAll("</script", "<\\/script");

const bundledHtml = html
  .replace(
    /\s*<link rel="stylesheet" href="\.\/style\.css\?v=[^"]+" \/>/,
    `\n    <style>\n${css}\n    </style>`,
  )
  .replace(
    /\s*<script src="\.\/app\.js\?v=[^"]+" defer><\/script>/,
    "",
  )
  .replace(
    '<script id="initial-markdown" type="application/json">null</script>',
    `<script id="initial-markdown" type="application/json">${embeddedMarkdown}</script>`,
  )
  .replace(
    "  </body>",
    `    <script>\n      document.addEventListener("DOMContentLoaded", () => {\n${embeddedJavascript}\n      });\n    </script>\n  </body>`,
  );

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(join(sourceRoot, "assets"), join(outputRoot, "assets"), {
  recursive: true,
});
await Promise.all([
  writeFile(join(outputRoot, "index.html"), bundledHtml, "utf8"),
  cp(join(sourceRoot, "style.css"), join(outputRoot, "style.css")),
  cp(join(sourceRoot, "app.js"), join(outputRoot, "app.js")),
  cp(join(sourceRoot, "landing.md"), join(outputRoot, "landing.md")),
  cp(join(sourceRoot, "README.md"), join(outputRoot, "README.md")),
  cp(join(sourceRoot, ".htaccess"), join(outputRoot, ".htaccess")),
  cp(join(projectRoot, "CHANGELOG.md"), join(outputRoot, "CHANGELOG.md")),
]);

console.log("Packaged optimized landing page in .deploy-raavi-publish");
