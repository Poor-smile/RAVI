import { spawnSync } from "node:child_process";
import path from "node:path";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  console.error("ED-KB release gate must be started through npm.");
  process.exit(1);
}
const playwrightCli = path.join(
  process.cwd(),
  "node_modules",
  "playwright",
  "cli.js",
);

const stages = [
  {
    name: "Static checks",
    command: process.execPath,
    args: [npmCli, "run", "lint"],
  },
  {
    name: "TypeScript contract",
    command: process.execPath,
    args: [npmCli, "run", "typecheck"],
  },
  {
    name: "ED-KB-01/02 — block ranges and structural service",
    command: process.execPath,
    args: [
      "--import",
      "tsx",
      "--test",
      "tests/block-range-resolver.test.ts",
      "tests/block-operations.test.ts",
      "tests/list-blocks.test.ts",
    ],
  },
  {
    name: "ED-KB-03..11 — structural keyboard, drag, double-click and Slash Menu",
    command: process.execPath,
    args: [
      playwrightCli,
      "test",
      "--config",
      "tests/live-edit.config.ts",
      "tests/structural-block-operations.spec.ts",
      "tests/nested-list-blocks.spec.ts",
      "tests/double-click-selection.spec.ts",
      "tests/w05-block-type-menu.spec.ts",
    ],
  },
  {
    name: "ED-KB-12/13 — all nine Selection Toolbar actions",
    command: process.execPath,
    args: [
      playwrightCli,
      "test",
      "--config",
      "tests/live-edit.config.ts",
      "tests/editor-tools.spec.ts",
    ],
  },
  {
    name: "ED-KB persistence — .ravi save/reopen block boundaries",
    command: process.execPath,
    args: [
      playwrightCli,
      "test",
      "--config",
      "tests/live-edit.config.ts",
      "tests/editor-kb-release.spec.ts",
    ],
  },
  {
    name: "Legacy editor regression",
    command: process.execPath,
    args: [
      "--import",
      "tsx",
      "--test",
      "tests/editor-mode.test.ts",
      "tests/editor-tools.test.ts",
      "tests/inline-markdown.test.ts",
      "tests/rich-blocks.test.ts",
      "tests/semantic-anchor.test.ts",
    ],
  },
  {
    name: "Legacy editor browser regression",
    command: process.execPath,
    args: [
      playwrightCli,
      "test",
      "--config",
      "tests/live-edit.config.ts",
      "tests/live-edit.spec.ts",
      "tests/inline-markdown.spec.ts",
      "tests/rich-blocks.spec.ts",
      "tests/context-continuity.spec.ts",
      "tests/w03-writing.spec.ts",
      "tests/w04-active-block.spec.ts",
      "tests/w14-block-selection.spec.ts",
    ],
  },
  {
    name: "Keyboard registry and Shortcuts Settings",
    command: process.execPath,
    args: [
      playwrightCli,
      "test",
      "tests/keyboard-shortcuts.spec.ts",
      "--grep",
      "command resolver|platform-aware shortcut help",
    ],
  },
  {
    name: "Production build",
    command: process.execPath,
    args: [npmCli, "run", "build"],
  },
];

const startedAt = Date.now();

for (const [index, stage] of stages.entries()) {
  const prefix = `[ED-KB Release ${index + 1}/${stages.length}]`;
  console.log(`\n${prefix} ${stage.name}`);
  const result = spawnSync(stage.command, stage.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`${prefix} could not start:`, result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${prefix} failed with exit code ${result.status ?? 1}.`);
    process.exit(result.status ?? 1);
  }
}

const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\nED-KB release gate passed in ${elapsedSeconds}s.`);
