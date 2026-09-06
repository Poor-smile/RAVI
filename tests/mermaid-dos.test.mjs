import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

for (const mode of ["control", "degenerate"]) {
  test(`Mermaid XY ${mode} finishes safely in a bounded process`, { timeout: 40_000 }, async () => {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--max-old-space-size=192", fileURLToPath(new URL("./fixtures/mermaid-parser-probe.mjs", import.meta.url)), mode], {
        windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const kill = () => { timedOut = true; child.kill(); };
      // Bound cold module loading separately from processing untrusted input.
      // The parser gets the same 8-second watchdog used by the release audit.
      let timer = setTimeout(kill, 30_000);
      let ready = false;
      child.stdout.on("data", (chunk) => {
        stdout = (stdout + chunk).slice(-4_000);
        if (!ready && stdout.includes('"ready":true')) {
          ready = true;
          clearTimeout(timer);
          timer = setTimeout(kill, 8_000);
        }
      });
      child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-4_000); });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
      child.once("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut }); });
    });
    assert.equal(result.timedOut, false, result.stderr);
    assert.equal(result.code, 0, result.stderr);
    assert.doesNotMatch(result.stderr, /heap out of memory|allocation failed/i);
    const parsed = JSON.parse(result.stdout.trim().split("\n").at(-1));
    // The patched version normalizes the degenerate range and returns safely.
    assert.equal(parsed.parsed, true, result.stdout);
  });
}
