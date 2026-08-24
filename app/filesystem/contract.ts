export type LibraryRuntime = "web" | "electron" | "tauri";

export type LibraryCapabilities = {
  createFile: boolean;
  createFolder: boolean;
  rename: boolean;
  move: boolean;
  delete: boolean;
  undoDelete: boolean;
  watch: boolean;
};

export const READ_ONLY_LIBRARY_CAPABILITIES: LibraryCapabilities = {
  createFile: false,
  createFolder: false,
  rename: false,
  move: false,
  delete: false,
  undoDelete: false,
  watch: false,
};

export const WRITABLE_LIBRARY_CAPABILITIES: LibraryCapabilities = {
  createFile: true,
  createFolder: true,
  rename: true,
  move: true,
  delete: true,
  undoDelete: true,
  watch: true,
};

export type LibraryMutationRequest =
  | {
      kind: "create-file";
      rootId: string;
      parentPath: string;
      name: string;
      content?: string;
    }
  | {
      kind: "create-folder";
      rootId: string;
      parentPath: string;
      name: string;
    }
  | {
      kind: "rename";
      rootId: string;
      sourcePath: string;
      name: string;
      entryKind: "file" | "folder";
    }
  | {
      kind: "move";
      rootId: string;
      sourcePath: string;
      destinationFolder: string;
      entryKind: "file" | "folder";
    }
  | {
      kind: "delete";
      rootId: string;
      sourcePath: string;
      entryKind: "file" | "folder";
    };

export type LibraryMutationResult = {
  kind: LibraryMutationRequest["kind"] | "undo";
  rootId: string;
  previousPath?: string;
  nextPath?: string;
  undoToken?: string;
};

export type LibraryMutationResponse<TScan> = {
  result: LibraryMutationResult;
  scan: TScan;
};

/**
 * Shared boundary for browser, Electron and a future Tauri transport. UI code
 * exchanges relative paths and semantic errors only; native absolute paths
 * never become mutation authority in the renderer.
 */
export interface LibraryFileSystemAdapter<TScan> {
  runtime: LibraryRuntime;
  capabilities: LibraryCapabilities;
  mutate: (
    request: LibraryMutationRequest,
  ) => Promise<LibraryMutationResponse<TScan>>;
  undoDelete: (token: string) => Promise<LibraryMutationResponse<TScan>>;
  subscribe?: (listener: (reason: "external" | "mutation") => void) => () => void;
}

export type LibraryErrorCode =
  | "invalid-name"
  | "unsafe-path"
  | "already-exists"
  | "missing"
  | "permission"
  | "dirty"
  | "unsupported"
  | "unknown";

export type LibraryOperationError = Error & {
  code: LibraryErrorCode;
};

const WINDOWS_RESERVED_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;
const INVALID_WINDOWS_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/u;

export function validateLibraryEntryName(
  value: string,
  options: { kind: "file" | "folder"; markdownOnly?: boolean },
) {
  const name = value.normalize("NFC").trim();
  if (!name || name === "." || name === "..") {
    return "نام نمی‌تواند خالی، نقطه یا دونقطه باشد.";
  }
  if (
    INVALID_WINDOWS_CHARACTERS.test(name) ||
    name.endsWith(".") ||
    name.endsWith(" ")
  ) {
    return "نام شامل نویسهٔ نامعتبر ویندوز است یا با نقطه/فاصله تمام می‌شود.";
  }
  if (WINDOWS_RESERVED_NAMES.test(name)) {
    return "این نام در سیستم‌عامل رزرو شده است؛ نام دیگری انتخاب کنید.";
  }
  if (
    options.kind === "file" &&
    options.markdownOnly !== false &&
    !/\.(?:md|markdown)$/iu.test(name)
  ) {
    return "فایل تازه باید پسوند .md یا .markdown داشته باشد.";
  }
  return "";
}

export function validateLibraryDocumentRename(
  currentName: string,
  nextName: string,
) {
  const basicError = validateLibraryEntryName(nextName, {
    kind: "file",
    markdownOnly: false,
  });
  if (basicError) return basicError;
  if (/\.ravi$/iu.test(currentName)) {
    return /\.ravi$/iu.test(nextName)
      ? ""
      : "سند قدیمی را تغییر نام ندهید؛ ابتدا آن را به Markdown تبدیل کنید.";
  }
  return /\.(?:md|markdown)$/iu.test(nextName)
    ? ""
    : "برای حفظ فایل Markdown، پسوند نام تازه باید .md یا .markdown باشد.";
}

export function normalizeLibraryRelativePath(value: string) {
  const normalized = value
    .normalize("NFC")
    .replace(/\\/gu, "/")
    .replace(/^\/+|\/+$/gu, "");
  if (!normalized) return "";
  const parts = normalized.split("/");
  if (
    parts.some(
      (part) =>
        !part ||
        part === "." ||
        part === ".." ||
        INVALID_WINDOWS_CHARACTERS.test(part),
    )
  ) {
    throw makeLibraryError("unsafe-path", "مسیر انتخاب‌شده امن نیست.");
  }
  return parts.join("/");
}

export function joinLibraryPath(parentPath: string, name: string) {
  const parent = normalizeLibraryRelativePath(parentPath);
  return normalizeLibraryRelativePath(parent ? `${parent}/${name}` : name);
}

export function parentLibraryPath(value: string) {
  const normalized = normalizeLibraryRelativePath(value);
  const separator = normalized.lastIndexOf("/");
  return separator < 0 ? "" : normalized.slice(0, separator);
}

export function libraryBaseName(value: string) {
  const normalized = normalizeLibraryRelativePath(value);
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

export function makeLibraryError(
  code: LibraryErrorCode,
  message: string,
): LibraryOperationError {
  return Object.assign(new Error(message), { code });
}

export function normalizeLibraryError(error: unknown): LibraryOperationError {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    const code = error.code.toLocaleLowerCase("en-US");
    if (code === "eexist") {
      return makeLibraryError(
        "already-exists",
        "فایل یا پوشه‌ای با این نام از قبل وجود دارد.",
      );
    }
    if (code === "enoent") {
      return makeLibraryError(
        "missing",
        "این مورد دیگر در مسیر قبلی وجود ندارد؛ فهرست را به‌روز کنید.",
      );
    }
    if (code === "eacces" || code === "eperm" || code === "notallowederror") {
      return makeLibraryError(
        "permission",
        "سیستم‌عامل اجازهٔ این عملیات را نداد؛ دسترسی پوشه را بررسی کنید.",
      );
    }
    if (
      [
        "invalid-name",
        "unsafe-path",
        "already-exists",
        "missing",
        "permission",
        "dirty",
        "unsupported",
      ].includes(code)
    ) {
      return error as LibraryOperationError;
    }
  }
  return makeLibraryError(
    "unknown",
    error instanceof Error && error.message
      ? error.message
      : "عملیات فایل کامل نشد؛ دوباره تلاش کنید.",
  );
}

export function libraryErrorMessage(error: unknown) {
  return normalizeLibraryError(error).message;
}
