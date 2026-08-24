import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const MAX_CONTEXT_LENGTH = 480_000;
const MAX_PROMPT_LENGTH = 24_000;
const MAX_OUTPUT_LENGTH = 1_200_000;
const EXECUTION_TIMEOUT_MS = 180_000;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    replacement: { type: ["string", "null"] },
  },
  required: ["answer", "replacement"],
};

const PERSIAN_REVIEW_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          reason: { type: "string" },
          current: { type: "string" },
          replacement: { type: "string" },
          occurrence: { type: "integer", minimum: 1 },
        },
        required: [
          "category",
          "reason",
          "current",
          "replacement",
          "occurrence",
        ],
      },
    },
  },
  required: ["summary", "suggestions"],
};

const SMART_ANNOTATIONS_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          reason: { type: "string" },
          current: { type: "string" },
          replacement: { type: "string" },
          occurrence: { type: "integer", minimum: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["category", "reason", "current", "replacement", "occurrence", "confidence"],
      },
    },
  },
  required: ["summary", "findings"],
};

function nativeCodexCandidatesFromShim(shimPath) {
  if (!path.isAbsolute(shimPath)) return [];
  const npmPrefix = path.dirname(shimPath);
  const architectures = process.arch === "arm64"
    ? [["codex-win32-arm64", "aarch64-pc-windows-msvc"]]
    : [["codex-win32-x64", "x86_64-pc-windows-msvc"]];
  return architectures.map(([packageName, vendorDirectory]) =>
    path.join(
      npmPrefix,
      "node_modules",
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      packageName,
      "vendor",
      vendorDirectory,
      "bin",
      "codex.exe",
    ),
  );
}

function commandCandidates(environment = process.env) {
  const candidates = [];
  if (process.platform === "win32") {
    if (environment.APPDATA) {
      candidates.push(
        ...nativeCodexCandidatesFromShim(
          path.join(environment.APPDATA, "npm", "codex.cmd"),
        ),
      );
    }
    const customNpmPrefix = environment.NPM_CONFIG_PREFIX ?? environment.npm_config_prefix;
    if (customNpmPrefix) {
      candidates.push(
        ...nativeCodexCandidatesFromShim(path.join(customNpmPrefix, "codex.cmd")),
      );
    }
    if (environment.LOCALAPPDATA) {
      candidates.push(
        path.join(environment.LOCALAPPDATA, "Programs", "codex", "codex.exe"),
      );
    }
    candidates.push("codex.exe");
  } else {
    candidates.push("codex");
  }
  return candidates;
}

async function canAccess(candidate) {
  if (!path.isAbsolute(candidate)) return true;
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function spawnResult(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    let outputLength = 0;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const capture = (target) => (chunk) => {
      outputLength += chunk.length;
      if (outputLength > MAX_OUTPUT_LENGTH) {
        child.kill();
        finish(reject, new Error("Codex CLI output exceeded the safe limit."));
        return;
      }
      target.push(chunk);
    };
    child.stdout?.on("data", capture(stdout));
    child.stderr?.on("data", capture(stderr));
    child.once("error", (error) => finish(reject, error));
    child.once("close", (code) =>
      finish(resolve, {
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
    const timer = setTimeout(() => {
      child.kill();
      finish(reject, new Error("Codex CLI request timed out."));
    }, options.timeoutMs ?? 15_000);
    if (options.input !== undefined) child.stdin?.end(options.input, "utf8");
  });
}

export async function resolveCodexCommand() {
  const candidates = commandCandidates();
  if (process.platform === "win32") {
    try {
      const located = await spawnResult("where.exe", ["codex"]);
      if (located.code === 0) {
        const locatedCommands = located.stdout
          .split(/\r?\n/u)
          .map((value) => value.trim())
          .filter(Boolean);
        candidates.unshift(
          ...locatedCommands.flatMap((value) =>
            /\.cmd$/iu.test(value)
              ? nativeCodexCandidatesFromShim(value)
              : /\.exe$/iu.test(value)
                ? [value]
                : [],
          ),
        );
      }
    } catch {
      // The explicit install locations below remain available.
    }
  }
  for (const candidate of [...new Set(candidates)]) {
    if (!(await canAccess(candidate))) continue;
    try {
      const result = await spawnResult(candidate, ["--version"]);
      if (result.code === 0) return candidate;
    } catch {
      // Continue through the platform-specific candidates.
    }
  }
  return null;
}

export async function getCodexConnectionStatus() {
  const command = await resolveCodexCommand();
  if (!command) return { state: "cli_missing" };
  try {
    const result = await spawnResult(command, ["login", "status"]);
    const message = `${result.stdout}\n${result.stderr}`.trim();
    if (result.code === 0 && /logged in/i.test(message)) {
      return { state: "connected" };
    }
    return { state: "auth_required" };
  } catch {
    return { state: "connection_error" };
  }
}

export function buildCodexPrompt({ context, prompt }) {
  const safeContext = String(context ?? "").slice(0, MAX_CONTEXT_LENGTH);
  const safePrompt = String(prompt ?? "").trim().slice(0, MAX_PROMPT_LENGTH);
  if (!safePrompt) throw new Error("A prompt is required.");
  return [
    "You are the writing assistant inside Raavi, a Persian Markdown editor.",
    "Answer the user's request about the frozen context below.",
    "Preserve Markdown syntax and the original language unless the user asks otherwise.",
    "Do not mention tools, files, repositories, or implementation details.",
    "Set replacement to the exact complete replacement text only when a direct edit is useful; otherwise set it to null.",
    "Return only the JSON object required by the output schema.",
    "",
    "<frozen_context>",
    safeContext,
    "</frozen_context>",
    "",
    "<user_request>",
    safePrompt,
    "</user_request>",
  ].join("\n");
}

export function buildPersianReviewPrompt({ document, economy = false }) {
  const safeDocument = String(document ?? "").slice(0, MAX_CONTEXT_LENGTH);
  return [
    "You are the advanced Persian proofreader inside Raavi, a Persian Markdown editor.",
    "Review the frozen Markdown document and return only the JSON object required by the output schema.",
    "Find contextual issues: spelling in context, grammar, ambiguity, inconsistent tone, repetition, verbosity, inconsistent terminology, mixed Persian/English punctuation, numbers/dates/units, and RTL table clarity.",
    "Do not repeat purely mechanical fixes such as Arabic yeh/kaf, half-spaces, heading spacing, trailing spaces, or blank lines unless meaning depends on them.",
    "Every suggestion must be optional, minimal, and independently applicable.",
    "current must be an exact contiguous quote copied from the frozen document. Never normalize it.",
    "occurrence is the 1-based occurrence of that exact current quote in the complete frozen document.",
    "replacement is the exact complete replacement for current, preserving Markdown syntax.",
    "Never alter fenced code, inline code, URLs, file paths, variable names, product names, or English technical terms. If a suggestion cannot preserve them exactly, omit it.",
    "Do not invent facts, names, dates, units, or sources.",
    "Keep reason short, specific, and in Persian. Keep category short and in Persian.",
    economy
      ? "Economy mode is active: combine related checks and return at most 20 high-value suggestions."
      : "Return at most 80 suggestions, ordered by their first appearance in the document.",
    "",
    "<frozen_markdown_document>",
    safeDocument,
    "</frozen_markdown_document>",
  ].join("\n");
}

export function buildSmartAnnotationsPrompt({ document, economy = false }) {
  const safeDocument = String(document ?? "").slice(0, MAX_CONTEXT_LENGTH);
  return [
    "You are Raavi Smart, reviewing a complete Persian Markdown document.",
    "Return only the JSON object required by the output schema.",
    "Find document-level issues only: repetition/verbosity, contradictions, ambiguity, narrative jumps, inconsistent terminology, weak heading structure, mismatch between introduction and conclusion, claims lacking enough explanation, and unclear tables or lists.",
    "Each finding becomes a comment attached to an exact quote. current must be an exact contiguous quote copied verbatim from the document and occurrence is its 1-based occurrence.",
    "replacement must be a minimal optional suggestion. If no safe rewrite exists, repeat current as replacement.",
    "Use one category from: ابهام، تناقض، تکرار، پرش روایی، ناهماهنگی اصطلاحات، ساختار عنوان‌ها، مقدمه و نتیجه‌گیری، ادعای نیازمند توضیح، جدول یا فهرست، سایر.",
    "confidence is between 0 and 1. Never invent facts or externally verify claims.",
    "Never change fenced code, inline code, URLs, file paths, variable names, product names, identifiers, or Markdown syntax.",
    economy ? "Economy mode is active: return at most 20 high-value findings." : "Return at most 80 findings ordered by first appearance.",
    "",
    "<frozen_markdown_document>",
    safeDocument,
    "</frozen_markdown_document>",
  ].join("\n");
}

async function runStructuredCodex(prompt, schema) {
  const command = await resolveCodexCommand();
  if (!command) throw new Error("CODEX_CLI_MISSING");
  const status = await getCodexConnectionStatus();
  if (status.state !== "connected") throw new Error("CODEX_AUTH_REQUIRED");

  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "raavi-codex-"));
  const schemaPath = path.join(temporaryDirectory, "response.schema.json");
  const outputPath = path.join(temporaryDirectory, "response.json");
  try {
    await writeFile(schemaPath, JSON.stringify(schema), "utf8");
    const result = await spawnResult(
      command,
      [
        "--ask-for-approval",
        "never",
        "exec",
        "--ephemeral",
        "--ignore-user-config",
        "--ignore-rules",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--output-schema",
        schemaPath,
        "--output-last-message",
        outputPath,
        "-C",
        temporaryDirectory,
        "-",
      ],
      {
        cwd: temporaryDirectory,
        input: prompt,
        timeoutMs: EXECUTION_TIMEOUT_MS,
      },
    );
    if (result.code !== 0) {
      const detail = result.stderr.trim() || "Codex CLI request failed.";
      if (/usage limit|rate limit|quota|too many requests/iu.test(detail)) {
        throw new Error("CODEX_QUOTA_EXHAUSTED");
      }
      throw new Error(detail);
    }
    return JSON.parse(await readFile(outputPath, "utf8"));
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

export async function runCodexPrompt(payload) {
  const parsed = await runStructuredCodex(
    buildCodexPrompt(payload),
    RESPONSE_SCHEMA,
  );
  if (typeof parsed?.answer !== "string") {
    throw new Error("Codex CLI returned an invalid response.");
  }
  return {
    answer: parsed.answer.trim(),
    replacement:
      typeof parsed.replacement === "string" ? parsed.replacement : null,
  };
}

export async function runCodexPersianReview(payload) {
  const parsed = await runStructuredCodex(
    buildPersianReviewPrompt(payload),
    PERSIAN_REVIEW_RESPONSE_SCHEMA,
  );
  if (!Array.isArray(parsed?.suggestions) || typeof parsed?.summary !== "string") {
    throw new Error("Codex CLI returned an invalid Persian review response.");
  }
  return {
    summary: parsed.summary.trim(),
    suggestions: parsed.suggestions,
  };
}

export async function runCodexSmartAnnotations(payload) {
  const parsed = await runStructuredCodex(
    buildSmartAnnotationsPrompt(payload),
    SMART_ANNOTATIONS_RESPONSE_SCHEMA,
  );
  if (!Array.isArray(parsed?.findings) || typeof parsed?.summary !== "string") {
    throw new Error("Codex CLI returned an invalid smart annotation response.");
  }
  return { summary: parsed.summary.trim(), findings: parsed.findings };
}

export async function startCodexLogin() {
  const command = await resolveCodexCommand();
  if (!command) return { started: false, state: "cli_missing" };
  try {
    const child = spawn(command, ["login"], {
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    });
    child.unref();
    return { started: true, state: "auth_waiting" };
  } catch {
    return { started: false, state: "connection_error" };
  }
}
