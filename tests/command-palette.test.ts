import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCommandQuery,
  parseCommandUsage,
  rankPaletteCommands,
  recordCommandUsage,
} from "../app/commands/command-palette";
import {
  ALL_COMMAND_IDS,
  COMMAND_REGISTRY,
  type CommandEnvironment,
} from "../app/keyboard/command-registry";
import { registryConflicts } from "../app/keyboard/command-resolver";

test("registry exposes complete searchable metadata for every unique command", () => {
  assert.equal(new Set(ALL_COMMAND_IDS).size, ALL_COMMAND_IDS.length);
  for (const command of COMMAND_REGISTRY) {
    assert.ok(command.title.trim(), `${command.id} title`);
    assert.ok(command.description.trim(), `${command.id} description`);
    assert.ok(command.icon, `${command.id} icon`);
    assert.ok(command.keywords.some((keyword) => /[a-z]/iu.test(keyword)), `${command.id} English alias`);
  }
});

test("Persian normalization unifies Arabic and Persian keyboard forms", () => {
  assert.equal(normalizeCommandQuery("  ذخيره‌ي فايل  "), "ذخیره ی فایل");
  assert.equal(normalizeCommandQuery("كُد"), "کد");
});

test("palette ranks Persian titles and English aliases without hiding disabled commands", () => {
  assert.equal(rankPaletteCommands(COMMAND_REGISTRY, "ذخیره", {})[0]?.id, "file.save");
  assert.equal(rankPaletteCommands(COMMAND_REGISTRY, "dark", {})[0]?.id, "view.theme");
  assert.ok(rankPaletteCommands(COMMAND_REGISTRY, "quick open", {}).some((command) => command.id === "file.quickOpen"));
  assert.equal(
    rankPaletteCommands(COMMAND_REGISTRY, "جداکننده", {})[0]?.id,
    "edit.divider",
  );
  assert.equal(
    rankPaletteCommands(COMMAND_REGISTRY, "بلوک کد", {})[0]?.id,
    "edit.codeBlock",
  );
});

test("recent ranking is local, bounded, and tolerant of corrupt storage", () => {
  const used = recordCommandUsage({}, "view.theme", 100);
  const usedAgain = recordCommandUsage(used, "view.theme", 200);
  assert.deepEqual(usedAgain["view.theme"], { count: 2, lastUsedAt: 200 });
  assert.deepEqual(parseCommandUsage("not-json"), {});
  assert.deepEqual(parseCommandUsage(JSON.stringify({ "view.theme": { count: 4, lastUsedAt: 300 } })), {
    "view.theme": { count: 4, lastUsedAt: 300 },
  });
});

test("usage only reorders matching search results and never leaks unrelated commands", () => {
  const usage = recordCommandUsage({}, "view.theme", Date.now());
  assert.deepEqual(
    rankPaletteCommands(COMMAND_REGISTRY, "فرمانی که وجود ندارد", usage),
    [],
  );
  assert.equal(
    rankPaletteCommands(COMMAND_REGISTRY, "بازکردن", usage)[0]?.id,
    "file.open",
  );
});

test("command palette shortcut has no active conflict on supported environments", () => {
  const environments: CommandEnvironment[] = [
    { platform: "windows", surface: "web" },
    { platform: "windows", surface: "electron" },
    { platform: "mac", surface: "web" },
    { platform: "linux", surface: "web" },
  ];
  for (const environment of environments) assert.deepEqual(registryConflicts(environment), []);
});
