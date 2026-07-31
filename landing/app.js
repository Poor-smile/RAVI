(() => {
  "use strict";

  const source = document.querySelector("#markdown-source");
  const preview = document.querySelector("#markdown-preview");
  const resetButton = document.querySelector("#reset-content");
  const status = document.querySelector("#editor-status");
  const stats = document.querySelector("#editor-stats");
  const workbench = document.querySelector(".workbench");
  const sourceTab = document.querySelector("#source-tab");
  const previewTab = document.querySelector("#preview-tab");
  const changelogTrigger = document.querySelector("#open-changelog");
  const changelogDialog = document.querySelector("#changelog-dialog");
  const changelogClose = document.querySelector("#close-changelog");
  const changelogDismiss = document.querySelector("#dismiss-changelog");
  const changelogContent = document.querySelector("#changelog-content");
  const hashCopyButtons = document.querySelectorAll("[data-copy-hash]");
  const hashCopyStatus = document.querySelector("#hash-copy-status");

  if (
    !source ||
    !preview ||
    !resetButton ||
    !status ||
    !stats ||
    !workbench ||
    !sourceTab ||
    !previewTab
  ) {
    return;
  }

  let initialMarkdown = "";
  let renderFrame = 0;
  let changelogLoadId = 0;
  let changelogReturnFocus = null;

  const faNumber = new Intl.NumberFormat("fa-IR");

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeUrl(rawUrl) {
    const value = String(rawUrl).trim();

    if (
      value.startsWith("./") ||
      value.startsWith("../") ||
      value.startsWith("/") ||
      value.startsWith("#")
    ) {
      return escapeHtml(value);
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        return escapeHtml(parsed.href);
      }
    } catch {
      return "#";
    }

    return "#";
  }

  function inlineMarkdown(rawText) {
    let text = escapeHtml(rawText);
    const codeTokens = [];

    text = text.replace(/`([^`\n]+)`/g, (_match, code) => {
      const token = `%%RAAVI_CODE_${codeTokens.length}%%`;
      codeTokens.push(`<code>${code}</code>`);
      return token;
    });

    text = text.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      (_match, alt, url, title) => {
        const safe = safeUrl(url);
        const titleAttribute = title
          ? ` title="${escapeHtml(title)}"`
          : "";
        return `<img src="${safe}" alt="${alt}" loading="lazy"${titleAttribute}>`;
      },
    );

    text = text.replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_match, label, url) => {
        const safe = safeUrl(url);
        const external = /^https?:/i.test(url);
        const attributes = external
          ? ' target="_blank" rel="noopener noreferrer"'
          : "";
        return `<a href="${safe}"${attributes}>${label}</a>`;
      },
    );

    text = text.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");
    text = text.replace(
      /(^|[\s(])\*([^*\n]+)\*(?=$|[\s).،؛])/g,
      "$1<em>$2</em>",
    );

    codeTokens.forEach((html, index) => {
      text = text.replace(`%%RAAVI_CODE_${index}%%`, html);
    });

    return text;
  }

  function isTableDivider(line) {
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

    return (
      cells.length > 1 &&
      cells.every((cell) => /^:?-{3,}:?$/.test(cell))
    );
  }

  function parseTableRow(line) {
    return line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function isBlockStart(lines, index) {
    const line = lines[index] ?? "";
    const nextLine = lines[index + 1] ?? "";

    return (
      line.trim() === "" ||
      /^#{1,4}\s+/.test(line) ||
      /^```/.test(line.trim()) ||
      /^>\s?/.test(line) ||
      /^[-*+]\s+/.test(line) ||
      /^\d+\.\s+/.test(line) ||
      /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim()) ||
      (line.includes("|") && isTableDivider(nextLine))
    );
  }

  function renderMarkdown(markdown) {
    const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      const fenceMatch = trimmed.match(/^```([\w-]*)\s*$/);
      if (fenceMatch) {
        const language = fenceMatch[1];
        const codeLines = [];
        index += 1;

        while (index < lines.length && !/^```\s*$/.test(lines[index].trim())) {
          codeLines.push(lines[index]);
          index += 1;
        }

        if (index < lines.length) {
          index += 1;
        }

        const languageClass = language
          ? ` class="language-${escapeHtml(language)}"`
          : "";
        output.push(
          `<pre dir="ltr"><code${languageClass}>${escapeHtml(
            codeLines.join("\n"),
          )}</code></pre>`,
        );
        continue;
      }

      const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        output.push(
          `<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`,
        );
        index += 1;
        continue;
      }

      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        output.push("<hr>");
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quoteLines = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quoteLines.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        output.push(
          `<blockquote><p>${inlineMarkdown(quoteLines.join(" "))}</p></blockquote>`,
        );
        continue;
      }

      if (
        line.includes("|") &&
        index + 1 < lines.length &&
        isTableDivider(lines[index + 1])
      ) {
        const headers = parseTableRow(line);
        const rows = [];
        index += 2;

        while (index < lines.length && lines[index].includes("|")) {
          rows.push(parseTableRow(lines[index]));
          index += 1;
        }

        const headerHtml = headers
          .map((cell) => `<th scope="col">${inlineMarkdown(cell)}</th>`)
          .join("");
        const bodyHtml = rows
          .map(
            (row) =>
              `<tr>${headers
                .map(
                  (_header, cellIndex) =>
                    `<td>${inlineMarkdown(row[cellIndex] ?? "")}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("");

        output.push(
          `<div class="table-wrap"><table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
        );
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        const items = [];
        let taskList = false;

        while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
          const item = lines[index].replace(/^[-*+]\s+/, "");
          const taskMatch = item.match(/^\[([ xX])\]\s+(.+)$/);

          if (taskMatch) {
            taskList = true;
            const checked = taskMatch[1].toLowerCase() === "x";
            items.push(
              `<li><label><input type="checkbox" disabled${
                checked ? " checked" : ""
              }> ${inlineMarkdown(taskMatch[2])}</label></li>`,
            );
          } else {
            items.push(`<li>${inlineMarkdown(item)}</li>`);
          }
          index += 1;
        }

        output.push(
          `<ul${taskList ? ' class="task-list"' : ""}>${items.join("")}</ul>`,
        );
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
          items.push(
            `<li>${inlineMarkdown(
              lines[index].replace(/^\d+\.\s+/, ""),
            )}</li>`,
          );
          index += 1;
        }
        output.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      const paragraphLines = [trimmed];
      index += 1;
      while (index < lines.length && !isBlockStart(lines, index)) {
        paragraphLines.push(lines[index].trim());
        index += 1;
      }

      output.push(`<p>${inlineMarkdown(paragraphLines.join(" "))}</p>`);
    }

    return output.join("\n");
  }

  function wordCount(value) {
    const words = String(value)
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`|[\]()!-]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    return words.length;
  }

  function updateStats(value) {
    const words = wordCount(value);
    const lines = value ? value.split("\n").length : 0;
    stats.textContent = `${faNumber.format(words)} واژه · ${faNumber.format(
      lines,
    )} خط`;
  }

  function updatePreview() {
    const value = source.value;
    preview.innerHTML = renderMarkdown(value);
    updateStats(value);

    const changed = value !== initialMarkdown;
    resetButton.disabled = !changed;
    status.textContent = changed
      ? "پیش‌نمایش تغییر کرده است؛ برای شروع دوباره متن اصلی را بازگردانید."
      : "متن اصلی بدون تغییر است.";
  }

  function scheduleRender() {
    window.cancelAnimationFrame(renderFrame);
    renderFrame = window.requestAnimationFrame(updatePreview);
  }

  function selectMobileView(view) {
    const sourceSelected = view === "source";
    workbench.dataset.view = sourceSelected ? "source" : "preview";
    sourceTab.setAttribute("aria-selected", String(sourceSelected));
    previewTab.setAttribute("aria-selected", String(!sourceSelected));

    if (window.matchMedia("(max-width: 860px)").matches) {
      const activePane = sourceSelected
        ? document.querySelector("#source-pane")
        : document.querySelector("#preview-pane");
      activePane?.focus({ preventScroll: true });
    }
  }

  async function fetchChangelogSource() {
    const candidates = ["./CHANGELOG.md", "../CHANGELOG.md"];
    let lastError = new Error("فایل CHANGELOG.md پیدا نشد.");

    for (const url of candidates) {
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return await response.text();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  function enhanceChangelog() {
    if (!changelogContent) {
      return;
    }

    const nodes = Array.from(changelogContent.children);
    const fragment = document.createDocumentFragment();
    const releases = [];
    let currentRelease = null;

    nodes.forEach((node) => {
      if (node.tagName === "H1") {
        node.remove();
        return;
      }

      if (node.tagName === "H2") {
        node.innerHTML = node.innerHTML.replace(
          /^(\d+\.\d+\.\d+)/,
          '<bdi dir="ltr">$1</bdi>',
        );
        currentRelease = document.createElement("section");
        currentRelease.className = "changelog-release";
        currentRelease.append(node);
        fragment.append(currentRelease);
        releases.push(currentRelease);
        return;
      }

      if (currentRelease) {
        currentRelease.append(node);
        return;
      }

      if (node.tagName === "P") {
        node.classList.add("changelog-intro");
      }
      fragment.append(node);
    });

    changelogContent.replaceChildren(fragment);

    if (releases.length > 3) {
      const archive = document.createElement("details");
      archive.className = "changelog-archive";

      const summary = document.createElement("summary");
      summary.textContent = "نمایش همهٔ نسخه‌ها";

      const archiveBody = document.createElement("div");
      archiveBody.className = "changelog-archive-body";
      releases.slice(3).forEach((release) => archiveBody.append(release));

      archive.append(summary, archiveBody);
      changelogContent.append(archive);
    }
  }

  async function loadChangelog() {
    if (!changelogContent) {
      return;
    }

    const loadId = ++changelogLoadId;
    changelogContent.setAttribute("aria-busy", "true");
    changelogContent.innerHTML =
      '<p class="changelog-loading" role="status">در حال خواندن دفتر تغییرات…</p>';

    try {
      const markdown = (await fetchChangelogSource()).trim();
      if (!markdown) {
        throw new Error("فایل دفتر تغییرات خالی است.");
      }

      if (loadId !== changelogLoadId) {
        return;
      }

      changelogContent.innerHTML = renderMarkdown(markdown);
      enhanceChangelog();
      changelogContent.scrollTop = 0;
    } catch {
      if (loadId !== changelogLoadId) {
        return;
      }

      changelogContent.innerHTML = `
        <div class="changelog-error" role="alert">
          <strong>دفتر تغییرات بارگذاری نشد.</strong>
          <span>اتصال را بررسی کنید و دوباره تلاش کنید.</span>
          <button class="button button-secondary changelog-retry" type="button">
            تلاش دوباره
          </button>
        </div>
      `;
      changelogContent
        .querySelector(".changelog-retry")
        ?.addEventListener("click", loadChangelog);
    } finally {
      if (loadId === changelogLoadId) {
        changelogContent.removeAttribute("aria-busy");
      }
    }
  }

  async function copyHash(button) {
    const hash = button.dataset.copyHash;
    if (!hash) {
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(hash);
      } else {
        const temporaryInput = document.createElement("textarea");
        temporaryInput.value = hash;
        temporaryInput.setAttribute("readonly", "");
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.append(temporaryInput);
        temporaryInput.select();
        const copied = document.execCommand("copy");
        temporaryInput.remove();
        if (!copied) {
          throw new Error("copy failed");
        }
      }

      const originalLabel = button.textContent;
      button.textContent = "کپی شد";
      if (hashCopyStatus) {
        hashCopyStatus.textContent = "کد بررسی فایل کپی شد.";
      }
      window.setTimeout(() => {
        button.textContent = originalLabel;
      }, 1800);
    } catch {
      if (hashCopyStatus) {
        hashCopyStatus.textContent =
          "کپی خودکار انجام نشد؛ کد را انتخاب و دستی کپی کنید.";
      }
    }
  }

  function closeChangelog() {
    if (changelogDialog?.open) {
      changelogDialog.close();
    }
  }

  if (
    changelogTrigger &&
    changelogDialog &&
    changelogClose &&
    changelogDismiss &&
    changelogContent
  ) {
    changelogTrigger.addEventListener("click", () => {
      changelogReturnFocus = document.activeElement;
      changelogDialog.showModal();
      changelogClose.focus({ preventScroll: true });
      loadChangelog();
    });

    changelogClose.addEventListener("click", closeChangelog);
    changelogDismiss.addEventListener("click", closeChangelog);

    changelogDialog.addEventListener("click", (event) => {
      if (event.target === changelogDialog) {
        closeChangelog();
      }
    });

    changelogDialog.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeChangelog();
      }
    });

    changelogDialog.addEventListener("close", () => {
      if (changelogReturnFocus instanceof HTMLElement) {
        changelogReturnFocus.focus({ preventScroll: true });
      }
    });
  }

  source.addEventListener("input", scheduleRender);

  hashCopyButtons.forEach((button) => {
    button.addEventListener("click", () => copyHash(button));
  });

  resetButton.addEventListener("click", () => {
    source.value = initialMarkdown;
    updatePreview();
    status.textContent = "متن نمونه به نسخهٔ اصلی بازگردانده شد.";
    source.focus();
  });

  sourceTab.addEventListener("click", () => selectMobileView("source"));
  previewTab.addEventListener("click", () => selectMobileView("preview"));

  fetch("./landing.md", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.text();
    })
    .then((markdown) => {
      initialMarkdown = markdown.trim();
      source.value = initialMarkdown;
      updatePreview();
    })
    .catch(() => {
      source.value = "";
      source.disabled = true;
      resetButton.disabled = true;
      stats.textContent = "فایل معرفی بارگذاری نشد";
      status.textContent =
        "برای اجرای نمونه، پوشهٔ لندینگ باید از طریق هاست یا سرور محلی باز شود.";
      preview.innerHTML =
        '<p class="markdown-error">فایل <code>landing.md</code> در دسترس نیست. مطمئن شوید همهٔ فایل‌های پوشهٔ لندینگ کنار هم آپلود شده‌اند.</p>';
    });
})();
