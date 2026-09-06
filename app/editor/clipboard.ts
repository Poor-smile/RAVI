export async function copyPlainText(value: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // WebView clipboard permissions vary; continue with the synchronous fallback.
  }

  if (typeof document === "undefined" || !document.execCommand) return false;

  const activeElement = document.activeElement;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  Object.assign(textarea.style, {
    position: "fixed",
    insetInlineStart: "-9999px",
    top: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.append(textarea);

  try {
    textarea.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement) {
      activeElement.focus({ preventScroll: true });
    }
    const restoredSelection = document.getSelection();
    if (restoredSelection) {
      restoredSelection.removeAllRanges();
      for (const range of ranges) restoredSelection.addRange(range);
    }
  }
}

export async function copyCode(
  button: HTMLButtonElement,
  value: string,
) {
  const icon = button.firstElementChild?.cloneNode(true);
  const copied = await copyPlainText(value);
  const label = copied ? "کپی شد" : "کپی نشد";
  button.classList.toggle("is-copied", copied);
  button.classList.toggle("is-error", !copied);
  button.setAttribute("aria-label", label);
  button.title = label;
  button.replaceChildren(
    Object.assign(document.createElement("span"), {
      className: "cm-live-code-copy-feedback",
      textContent: label,
    }),
  );
  window.setTimeout(() => {
    if (!button.isConnected) return;
    button.classList.remove("is-copied", "is-error");
    button.setAttribute("aria-label", "کپی کد");
    button.title = "کپی کد";
    if (icon) button.replaceChildren(icon);
  }, copied ? 1_600 : 2_400);
}
