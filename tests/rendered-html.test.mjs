import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Persian Markdown viewer", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /lang="fa"/i);
  assert.match(html, /dir="rtl"/i);
  assert.match(html, /راوی/);
  assert.match(html, /ویور Markdown فارسی/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the viewer implementation instead of starter assets", async () => {
  const [
    page,
    appChrome,
    documentDialogs,
    workspaceLayout,
    layout,
    css,
    raavi,
    main,
    preload,
    packageJson,
    commandRegistry,
    commandResolver,
    shortcutHelp,
    aboutDialog,
    supportDialog,
    newDocumentDialog,
    markdownCodeEditor,
    readingSelectionMenu,
    fileSuggestionRow,
    sidebarComponent,
    textDirection,
    vazirCodeFont,
    vazirCodeLicense,
  ] =
    await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/app-chrome.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/document-dialogs.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/hooks/use-workspace-layout-state.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/raavi.ts", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(
      new URL("../app/keyboard/command-registry.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/keyboard/command-resolver.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/shortcut-help-dialog.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/about-dialog.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/support-dialog.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/new-document-dialog.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/markdown-code-editor.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/reading-selection-menu.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/file-suggestion-row.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/components/sidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/markdown/text-direction.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/fonts/Vazir-Code.woff2", import.meta.url)),
    readFile(
      new URL("../public/fonts/Vazir-Code-LICENSE.txt", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /ReactMarkdown/);
  assert.match(page, /ImagePlus/);
  assert.match(page, /edit\.image/);
  assert.match(page, /imageModalOpen/);
  assert.match(page, /imageSourceMode/);
  assert.match(page, /insertImageUrl/);
  assert.match(page, /writeMarkdownAnnotations/);
  assert.match(page, /referrerPolicy=\{isRemoteImage \? "no-referrer"/);
  assert.match(page, /raaviImageUrl/);
  assert.match(page, /markdownWithEmbeddedRaaviImages/);
  assert.match(page, /localStorage/);
  assert.match(page, /indexedDB/);
  assert.match(page, /raavi-local-documents/);
  assert.match(page, /text\/markdown/);
  assert.match(page, /showDirectoryPicker/);
  assert.match(page, /scanMarkdownDirectory/);
  assert.match(page, /raaviDesktop/);
  assert.match(page, /کتابخانه/);
  assert.match(page, /NewTabWorkspace/);
  assert.match(page, /VersionsPanel/);
  assert.match(page, /VersionsPanel/);
  assert.match(page, /restoreVersion/);
  assert.match(page, /تجربه بهتر با نسخه دسکتاپ/);
  assert.match(page, /دانلود برای Windows/);
  assert.match(page, /دانلود برای Linux/);
  assert.match(page, /isWebLibrary/);
  assert.match(page, /id="library-catalog-panel"/);
  assert.match(page, /در Markdown فقط URL ذخیره می‌شود/);
  assert.match(page, /هایلایت‌ها و نظرها در همین فایل Markdown قابل‌حمل می‌مانند/);
  assert.match(page, /LegacyAnnotationMigrationDialog/);
  assert.match(page, /capturePreviewSelection/);
  assert.match(page, /selection-mini-menu/);
  assert.match(page, /ReadingSelectionMenu/);
  assert.match(readingSelectionMenu, /ابزار متن انتخاب‌شده/);
  assert.match(page, /captureEditorSelection/);
  assert.match(page, /editor-selection-mini-menu/);
  assert.match(page, /data-mobile-editor-action="bold"/);
  assert.match(page, /className="format-tool-overflow"/);
  assert.match(page, /collapseDesktopPane\("preview"\)/);
  assert.match(page, /data-command-id="edit\.task"/);
  assert.match(page, /runEditorToolCommand\("edit\.task"\)/);
  assert.match(page, /data-command-id="edit\.list"/);
  assert.match(page, /runEditorToolCommand\("edit\.orderedList"\)/);
  assert.match(
    css,
    /\.editor-primary-tools[\s\S]*grid-template-columns:\s*repeat\(5/,
  );
  assert.match(
    css,
    /\.editor-primary-tools\s*>\s*button:not\(\[data-mobile-editor-action\]\)/,
  );
  assert.match(page, /قالب‌بندی متن انتخاب‌شده/);
  assert.match(page, /addAnnotation/);
  assert.match(page, /findAnnotationAtPoint/);
  assert.match(page, /onPointerMove=\{handleAnnotationPointerMove\}/);
  assert.match(page, /onClick=\{handleAnnotationClick\}/);
  assert.match(page, /annotation-hover-preview/);
  assert.match(page, /background: var\(--highlight-bg\)/);
  assert.match(page, /نظر یا بازخورد خود را بنویسید/);
  assert.match(page, /CSS[\s\S]*highlights/);
  assert.match(page, /saveCurrentFile/);
  assert.match(page, /saveAsFile/);
  assert.match(page, /فایل‌های اخیر/);
  assert.match(page, /افزودن پوشه/);
  assert.match(page, /SidebarRail/);
  assert.match(page, /RecentFilesPanel/);
  assert.match(page, /FileExplorer/);
  assert.match(sidebarComponent, /جمع‌کردن نوار کناری/);
  assert.match(sidebarComponent, /نماهای نوار کناری/);
  assert.match(page, /sidebar-pane-content/);
  assert.match(page, /سنجاق‌شده‌ها/);
  assert.match(page, /raavi:library-pins:v1/);
  assert.match(page, /useSidebarShellState/);
  assert.match(page, /sidebarCollapsedPreference/);
  assert.match(page, /SIDEBAR_STORAGE_KEY/);
  assert.match(page, /libraryPinKey/);
  assert.match(fileSuggestionRow, /file-suggestion-pin/);
  assert.match(page, /قفل کردن اسکرول ادیتور و پیش‌نمایش/);
  assert.match(page, /باز کردن قفل اسکرول هماهنگ/);
  assert.match(page, /تغییر اندازهٔ کد و نوشتن/);
  assert.match(appChrome, /editor-mode-switcher/);
  assert.match(appChrome, /EDITOR_MODES/);
  assert.match(workspaceLayout, /raavi:pane-layout:v1/);
  assert.match(page, /فهرست سند/);
  assert.match(page, /label: "فهرست سند"/);
  assert.doesNotMatch(page, /بازکردن فهرست سند|بستن فهرست سند/);
  assert.match(page, /readingHeaderVisible/);
  assert.match(page, /reading-header-document/);
  assert.match(page, /reading-topbar is-concealed/);
  assert.match(page, /detectDocumentTextDirection/);
  assert.match(textDirection, /LATIN_DIRECTION_THRESHOLD = 0\.7/);
  assert.match(
    textDirection,
    /latin \/ directionalLetterCount > LATIN_DIRECTION_THRESHOLD/,
  );
  assert.match(page, /dir=\{documentTextDirection\}/);
  assert.match(page, /topbar-document-zone/);
  assert.match(page, /data-primary-action="open"/);
  assert.match(page, /data-overflow-action="export"/);
  assert.match(appChrome, /هشدار: ذخیره نشده/);
  assert.match(documentDialogs, /تاریخچه‌ی نسخه‌ها/);
  assert.match(page, /بازیابی/);
  assert.match(raavi, /RAVI_VERSION = 1/);
  assert.match(raavi, /makeRaaviDocument/);
  assert.match(raavi, /RaaviVersion/);
  assert.match(raavi, /RAVI_IMAGE_URL_PREFIX/);
  assert.match(raavi, /RaaviImageAsset/);
  assert.match(raavi, /MAX_RAVI_IMAGE_BYTES/);
  assert.doesNotMatch(main, /document:save-ravi/);
  assert.match(main, /document:save-current/);
  assert.match(main, /renderer:ready/);
  assert.match(main, /openInReadingMode: true/);
  assert.match(main, /process\.platform !== "darwin"/);
  assert.doesNotMatch(preload, /saveRaavi/);
  assert.match(preload, /rendererReady/);
  assert.match(page, /<FileExplorer/);
  assert.match(page, /performBrowserLibraryMutation/);
  assert.match(main, /library:mutate/);
  assert.match(main, /library:undo/);
  assert.match(preload, /onLibraryChanged/);
  assert.match(page, /useCommandSystem/);
  assert.match(markdownCodeEditor, /"data-editable-kind": "editor"/);
  assert.match(markdownCodeEditor, /EditorView\.perLineTextDirection\.of\(true\)/);
  assert.doesNotMatch(markdownCodeEditor, /drawSelection|basicSetup/);
  assert.match(markdownCodeEditor, /Find: "جست‌وجو"/);
  assert.match(markdownCodeEditor, /"replace all": "جایگزینی همه"/);
  assert.match(commandRegistry, /id: "edit\.find"/);
  assert.match(commandRegistry, /id: "edit\.replace"/);
  assert.match(commandRegistry, /id: "edit\.findPrevious"/);
  assert.match(css, /\.cm-panel\.cm-search[\s\S]*height: 100px/);
  assert.match(markdownCodeEditor, /class RaaviFindPanel implements Panel/);
  assert.match(markdownCodeEditor, /موقعیت نتیجهٔ جست‌وجو/);
  assert.match(page, /aria-keyshortcuts/);
  assert.match(page, /theme-transition-overlay/);
  assert.match(page, /view\.theme/);
  assert.match(page, /aria-label="دربارهٔ راوی"/);
  assert.match(page, /packageMetadata\.version/);
  assert.match(page, /topLayer === "about"/);
  assert.match(page, /supportModalOpen/);
  assert.match(page, /topLayer === "support"/);
  assert.match(page, /حمایت از راوی/);
  assert.match(page, /openNewDocumentModal/);
  assert.match(page, /createNewDocument/);
  assert.match(page, /topLayer === "new"/);
  assert.match(commandRegistry, /COMMAND_REGISTRY/);
  assert.match(commandRegistry, /code: "KeyS"/);
  assert.match(commandRegistry, /code: "KeyT"/);
  assert.match(commandResolver, /event\.code === binding\.code/);
  assert.match(commandResolver, /event\.isComposing/);
  assert.match(shortcutHelp, /صفحه‌کلید فارسی/);
  assert.match(shortcutHelp, /CommandShortcutKeys/);
  assert.match(aboutDialog, /ویژگی‌های متمایز راوی/);
  assert.match(aboutDialog, /دفتر تغییرات/);
  assert.match(aboutDialog, /نسخهٔ جاری/);
  assert.match(aboutDialog, /returnFocusRef/);
  assert.match(aboutDialog, /0\.1\.0/);
  assert.match(aboutDialog, /0\.20\.0/);
  assert.match(aboutDialog, /1\.0\.0/);
  assert.match(aboutDialog, /حامیان راوی/);
  assert.match(aboutDialog, /اندیشکده حکمرانی شریف/);
  assert.match(aboutDialog, /مهدی میرزائی/);
  assert.match(aboutDialog, /امیرمحمد شفیعی/);
  assert.match(supportDialog, /https:\/\/daramet\.com\/poorsmile/);
  assert.match(supportDialog, /https:\/\/t\.me\/poorsmile_crafts/);
  assert.match(supportDialog, /https:\/\/ravi\.poorsmile\.ir/);
  assert.match(supportDialog, /راوی تا همیشه رایگان می‌ماند/);
  assert.match(supportDialog, /نامتان را در پیام حمایت بنویسید/);
  assert.match(newDocumentDialog, /validateNewDocumentName/);
  assert.match(newDocumentDialog, /WINDOWS_RESERVED_NAMES/);
  assert.match(newDocumentDialog, /ساخت فایل جدید/);
  assert.match(newDocumentDialog, /Markdown \(\.md\)/);
  assert.match(newDocumentDialog, /یادداشت‌ها و هایلایت‌ها در همین فایل استاندارد/);
  assert.match(layout, /lang="fa"/);
  assert.match(layout, /dir="rtl"/);
  assert.match(layout, /raavi:theme:v1/);
  assert.match(layout, /prefers-color-scheme: dark/);
  assert.match(css, /IRANSansX-Regular\.woff2/);
  assert.match(css, /Vazir-Code\.woff2/);
  assert.match(css, /--font-mono: "Vazir Code"/);
  assert.match(css, /--editor-font: var\(--font-mono\)/);
  assert.match(css, /--editor-surface-bg: #fafbf7/);
  assert.match(css, /\.cm-scroller[\s\S]*font-family: var\(--editor-font\) !important/);
  assert.ok(vazirCodeFont.byteLength > 40_000);
  assert.match(vazirCodeLicense, /Permission is hereby granted/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@keyframes themeNightfall/);
  assert.match(css, /\.annotation-hover-preview/);
  assert.match(css, /\.selection-mini-menu/);
  assert.match(css, /\.editor-selection-mini-menu/);
  assert.match(css, /\.editor-mini-action/);
  assert.match(css, /@keyframes selectionMiniMenuAboveIn/);
  assert.match(css, /\.markdown-body\.has-annotation-hover/);
  assert.match(css, /\.save-modal/);
  assert.match(css, /\.image-insert-modal/);
  assert.match(css, /\.image-source-tabs/);
  assert.match(css, /\.about-modal/);
  assert.match(css, /\.support-modal/);
  assert.match(css, /\.button--support/);
  assert.match(css, /\.about-supporters/);
  assert.match(css, /\.about-feature-list/);
  assert.match(css, /\.about-release-list/);
  assert.match(css, /\.new-document-modal/);
  assert.match(css, /\.new-document-unsaved-warning/);
  assert.match(css, /\.new-document-name-control/);
  assert.match(css, /\.library-pinned-section/);
  assert.match(css, /\.library-pin-action/);
  assert.match(css, /\.library-install-prompt/);
  assert.match(css, /\.library-tabs--single/);
  assert.match(css, /\.library-version-list/);
  assert.match(css, /\.pane-resize-handle/);
  assert.match(css, /\.work-pane\.is-pane-collapsed/);
  assert.match(css, /@keyframes paneCollapseReady/);
  assert.match(css, /height: 100dvh/);
  assert.match(packageJson, /"react-markdown"/);
  assert.match(packageJson, /"desktop:pack:linux"/);
  assert.match(packageJson, /"desktop:pack:linux:portable"/);
  assert.match(packageJson, /"desktop:pack:mac"/);
  assert.match(packageJson, /"target": "AppImage"/);
  assert.match(packageJson, /"target": "deb"/);
  assert.match(packageJson, /"target": "tar\.gz"/);
  assert.match(packageJson, /"target": "dmg"/);
  assert.match(packageJson, /"target": "zip"/);
  assert.match(packageJson, /"appimage": "1\.0\.3"/);
  assert.match(packageJson, /"desktop:pack"/);
  assert.match(packageJson, /"fileAssociations"/);
  assert.match(packageJson, /"md"/);
  assert.match(packageJson, /"markdown"/);
  assert.doesNotMatch(packageJson, /"ext": "ravi"/);
  assert.match(packageJson, /"perMachine":\s*true/);
  assert.doesNotMatch(
    `${page}\n${layout}\n${css}\n${packageJson}`,
    /SkeletonPreview|react-loading-skeleton|codex-preview/,
  );
});

test("ships the secure Mermaid Studio and standard-fence workflow", async () => {
  const [page, studio, renderer, blocks, css, packageJson, registry] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/mermaid-studio.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../app/mermaid/renderer.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/mermaid/blocks.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(
        new URL("../app/keyboard/command-registry.ts", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(page, /MermaidDiagram/);
  assert.match(page, /MermaidStudio/);
  assert.match(studio, /ساخت نمودار/);
  assert.match(studio, /پیش‌نمایش زنده/);
  assert.match(studio, /پیش‌نویس محلی این نمودار حذف می‌شود/);
  assert.match(studio, /پیش‌نمایش ساخته نشد/);
  assert.match(renderer, /securityLevel: "strict"/);
  assert.match(renderer, /DOMParser/);
  assert.match(renderer, /renderTimeoutMs/);
  assert.match(blocks, /replaceMermaidBlock/);
  assert.match(blocks, /makeMermaidFence/);
  assert.match(css, /\.mermaid-studio/);
  assert.match(css, /\.mermaid-diagram/);
  assert.match(
    css,
    /@media print[\s\S]*?\.mermaid-diagram-canvas\s*\{[\s\S]*?padding:\s*8mm;/u,
  );
  assert.match(
    css,
    /@media print[\s\S]*?\.mermaid-svg\s*\{[\s\S]*?max-height:\s*210mm;/u,
  );
  assert.match(packageJson, /"mermaid": "11\.16\.0"/);
  assert.match(registry, /id: "diagram\.mermaid"/);
  assert.match(registry, /code: "KeyM", alt: true/);
});
