"use client";

import {
  ChevronDown,
  ChevronLeft,
  Ellipsis,
  FileArchive,
  FileText,
  Folder,
  FolderOpen,
  Pin,
} from "@/app/icons/material-symbols";
import {
  type CSSProperties,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type FileExplorerFile = {
  id: string;
  rootId: string;
  rootName: string;
  relativePath: string;
  name: string;
  documentType: "markdown" | "ravi";
  lastModified?: number;
};

export type FileExplorerRoot = {
  rootId: string;
  rootName: string;
  rootPath: string;
  writable: boolean;
};

export type FileExplorerActionEntry =
  | { kind: "file"; rootId: string; relativePath: string; name: string }
  | { kind: "folder"; rootId: string; relativePath: string; name: string };

type TreeFolder = FileExplorerActionEntry & {
  kind: "folder";
  children: Map<string, TreeFolder>;
  files: FileExplorerFile[];
  rootName: string;
};

type VisibleRow =
  | { kind: "folder"; key: string; depth: number; folder: TreeFolder; writable: boolean }
  | { kind: "file"; key: string; depth: number; file: FileExplorerFile; writable: boolean };

const ROW_HEIGHT = 36;
const TREE_STATE_KEY = "raavi:file-tree:v1";

function fileKey(file: Pick<FileExplorerFile, "rootId" | "relativePath">) {
  return `${file.rootId}::${file.relativePath}`;
}

function folderKey(folder: Pick<TreeFolder, "rootId" | "relativePath">) {
  return `${folder.rootId}::folder:${folder.relativePath}`;
}

function countFolderFiles(folder: TreeFolder): number {
  let count = folder.files.length;
  for (const child of folder.children.values()) count += countFolderFiles(child);
  return count;
}

function fileMeta(file: FileExplorerFile, selected: boolean) {
  if (selected) return "فعال";
  if (!file.lastModified) return "";
  const modified = new Date(file.lastModified);
  const now = new Date();
  const modifiedDay = new Date(
    modified.getFullYear(),
    modified.getMonth(),
    modified.getDate(),
  ).getTime();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const elapsedDays = Math.round((today - modifiedDay) / 86_400_000);
  if (elapsedDays <= 0) return "امروز";
  if (elapsedDays === 1) return "دیروز";
  return modified.toLocaleDateString("fa-IR", {
    month: "numeric",
    day: "numeric",
  });
}

function buildRoots(roots: FileExplorerRoot[], files: FileExplorerFile[]) {
  const rootNodes = new Map<string, TreeFolder>();
  for (const root of roots) {
    rootNodes.set(root.rootId, {
      kind: "folder",
      rootId: root.rootId,
      rootName: root.rootName,
      relativePath: "",
      name: root.rootName,
      children: new Map(),
      files: [],
    });
  }
  for (const file of files) {
    const root = rootNodes.get(file.rootId);
    if (!root) continue;
    const segments = file.relativePath.split("/");
    segments.pop();
    let current = root;
    let currentPath = "";
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      if (!current.children.has(segment)) {
        current.children.set(segment, {
          kind: "folder",
          rootId: root.rootId,
          rootName: root.rootName,
          relativePath: currentPath,
          name: segment,
          children: new Map(),
          files: [],
        });
      }
      current = current.children.get(segment)!;
    }
    current.files.push(file);
  }
  return rootNodes;
}

function ancestorFolderKeys(file: FileExplorerFile) {
  const keys = [`${file.rootId}::folder:`];
  const segments = file.relativePath.split("/");
  segments.pop();
  let current = "";
  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment;
    keys.push(`${file.rootId}::folder:${current}`);
  }
  return keys;
}

function flattenRoots(
  roots: FileExplorerRoot[],
  tree: Map<string, TreeFolder>,
  expanded: ReadonlySet<string>,
  forceExpanded: boolean,
) {
  const rows: VisibleRow[] = [];
  const append = (folder: TreeFolder, depth: number, writable: boolean) => {
    const key = folderKey(folder);
    rows.push({ kind: "folder", key, depth, folder, writable });
    if (!forceExpanded && !expanded.has(key)) return;
    const childFolders = [...folder.children.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fa"),
    );
    for (const child of childFolders) append(child, depth + 1, writable);
    const childFiles = [...folder.files].sort((a, b) =>
      a.name.localeCompare(b.name, "fa"),
    );
    for (const file of childFiles) {
      rows.push({
        kind: "file",
        key: fileKey(file),
        depth: depth + 1,
        file,
        writable,
      });
    }
  };
  for (const root of roots) {
    const node = tree.get(root.rootId);
    if (node) append(node, 0, root.writable);
  }
  return rows;
}

export function FileExplorer({
  roots,
  files,
  activeKey,
  dirty,
  pinnedKeys,
  searchActive,
  showPinActions = false,
  onOpenFile,
  onTogglePin,
  onAction,
}: {
  roots: FileExplorerRoot[];
  files: FileExplorerFile[];
  activeKey: string;
  dirty: boolean;
  pinnedKeys: ReadonlySet<string>;
  searchActive: boolean;
  showPinActions?: boolean;
  onOpenFile: (file: FileExplorerFile) => void;
  onTogglePin: (file: FileExplorerFile) => void;
  onAction: (entry: FileExplorerActionEntry) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastActiveKeyRef = useRef("");
  const [viewportHeight, setViewportHeight] = useState(320);
  const [scrollTop, setScrollTop] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const tree = useMemo(() => buildRoots(roots, files), [files, roots]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const parsed = JSON.parse(localStorage.getItem(TREE_STATE_KEY) ?? "[]");
        if (Array.isArray(parsed)) {
          setExpanded(
            new Set(parsed.filter((value) => typeof value === "string")),
          );
        }
      } catch {
        // Expansion persistence is optional; the explorer remains functional.
      }
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(TREE_STATE_KEY, JSON.stringify([...expanded]));
      } catch {
        // Expansion persistence is optional.
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [expanded, hydrated]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportHeight(entry.contentRect.height);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const activeFile = useMemo(
    () => files.find((file) => fileKey(file) === activeKey),
    [activeKey, files],
  );

  useEffect(() => {
    if (!activeFile || activeKey === lastActiveKeyRef.current) return;
    lastActiveKeyRef.current = activeKey;
    setExpanded((current) => {
      const next = new Set(current);
      for (const key of ancestorFolderKeys(activeFile)) next.add(key);
      return next;
    });
  }, [activeFile, activeKey]);

  const rows = useMemo(
    () => flattenRoots(roots, tree, expanded, searchActive),
    [expanded, roots, searchActive, tree],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !activeKey) return;
    const index = rows.findIndex((row) => row.key === activeKey);
    if (index < 0) return;
    const top = index * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < viewport.scrollTop) viewport.scrollTo({ top });
    else if (bottom > viewport.scrollTop + viewport.clientHeight) {
      viewport.scrollTo({ top: bottom - viewport.clientHeight });
    }
  }, [activeKey, rows]);

  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 8);
  const end = Math.min(
    rows.length,
    Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + 8,
  );
  const visibleRows = rows.slice(start, end);

  const focusSibling = (event: KeyboardEvent<HTMLElement>, delta: number) => {
    const treeElement = viewportRef.current;
    if (!treeElement) return;
    const items = [...treeElement.querySelectorAll<HTMLElement>("[role=treeitem]")];
    const index = items.indexOf(event.currentTarget);
    const target = items[index + delta];
    if (target) {
      event.preventDefault();
      target.focus();
    }
  };

  return (
    <div
      ref={viewportRef}
      className="file-explorer"
      role="tree"
      aria-label="کاوشگر فایل‌های محلی"
      aria-busy={false}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div
        className="file-explorer-spacer"
        style={{ height: `${rows.length * ROW_HEIGHT}px` }}
      >
        {visibleRows.map((row, visibleIndex) => {
          const index = start + visibleIndex;
          const style = {
            "--tree-depth": row.depth,
            transform: `translateY(${index * ROW_HEIGHT}px)`,
          } as CSSProperties;
          if (row.kind === "folder") {
            const open = searchActive || expanded.has(row.key);
            return (
              <div
                className={`file-explorer-row is-folder ${row.depth === 0 ? "is-root" : ""}`}
                key={row.key}
                style={style}
              >
                <button
                  type="button"
                  className="file-explorer-main"
                  role="treeitem"
                  aria-level={row.depth + 1}
                  aria-selected={false}
                  aria-expanded={open}
                  title={row.folder.relativePath || row.folder.rootName}
                  onClick={() => {
                    if (searchActive) return;
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(row.key)) next.delete(row.key);
                      else next.add(row.key);
                      return next;
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") focusSibling(event, 1);
                    if (event.key === "ArrowUp") focusSibling(event, -1);
                    if (event.key === "ArrowLeft" && open && !searchActive) {
                      event.preventDefault();
                      setExpanded((current) => {
                        const next = new Set(current);
                        next.delete(row.key);
                        return next;
                      });
                    }
                    if (event.key === "ArrowRight" && !open) {
                      event.preventDefault();
                      setExpanded((current) => new Set(current).add(row.key));
                    }
                  }}
                >
                  {open ? <ChevronDown size={14} /> : <ChevronLeft size={14} />}
                  {open ? <FolderOpen size={18} /> : <Folder size={18} />}
                  <span className="file-explorer-label" dir="auto">
                    {row.folder.name}
                  </span>
                  <span className="file-explorer-meta">
                    {countFolderFiles(row.folder).toLocaleString("fa-IR")} فایل
                  </span>
                </button>
                <button
                  type="button"
                  className="file-explorer-action"
                  aria-label={`عملیات پوشهٔ «${row.folder.name}»`}
                  title="عملیات پوشه"
                  onClick={() => onAction(row.folder)}
                >
                  <Ellipsis size={18} aria-hidden="true" />
                </button>
              </div>
            );
          }

          const selected = row.key === activeKey;
          const pinned = pinnedKeys.has(row.key);
          return (
            <div
              className={`file-explorer-row is-file ${selected ? "is-active" : ""}`}
              key={row.key}
              style={style}
            >
              <button
                type="button"
                className="file-explorer-main"
                role="treeitem"
                aria-level={row.depth + 1}
                aria-selected={selected}
                aria-current={selected ? "page" : undefined}
                title={`${row.file.rootName}/${row.file.relativePath}`}
                onClick={() => onOpenFile(row.file)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") focusSibling(event, 1);
                  if (event.key === "ArrowUp") focusSibling(event, -1);
                }}
              >
                <span className="file-explorer-file-spacer" aria-hidden="true" />
                {row.file.documentType === "ravi" ? (
                  <FileArchive size={18} aria-hidden="true" />
                ) : (
                  <FileText size={18} aria-hidden="true" />
                )}
                <span className="file-explorer-label" dir="auto">
                  {row.file.name}
                </span>
                {selected && dirty && (
                  <span className="file-explorer-dirty" aria-label="تغییرات ذخیره‌نشده">
                    ●
                  </span>
                )}
                <span className="file-explorer-meta">
                  {fileMeta(row.file, selected)}
                </span>
              </button>
              {showPinActions && (
                <button
                  type="button"
                  className={`file-explorer-pin ${pinned ? "is-pinned" : ""}`}
                  aria-label={
                    pinned
                      ? `برداشتن «${row.file.name}» از سنجاق‌شده‌ها`
                      : `سنجاق‌کردن «${row.file.name}»`
                  }
                  aria-pressed={pinned}
                  title={pinned ? "برداشتن سنجاق" : "سنجاق‌کردن"}
                  onClick={() => onTogglePin(row.file)}
                >
                  <Pin size={14} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                className="file-explorer-action"
                aria-label={`عملیات فایل «${row.file.name}»`}
                title="عملیات فایل"
                onClick={() =>
                  onAction({
                    kind: "file",
                    rootId: row.file.rootId,
                    relativePath: row.file.relativePath,
                    name: row.file.name,
                  })
                }
              >
                <Ellipsis size={18} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
