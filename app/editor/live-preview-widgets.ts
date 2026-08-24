import { EditorView, ViewPlugin, WidgetType } from "@codemirror/view";

export class StaticMarkerWidget extends WidgetType {
  constructor(
    private readonly text: string,
    private readonly className: string,
    private readonly label?: string,
  ) {
    super();
  }

  eq(other: StaticMarkerWidget) {
    return (
      other.text === this.text &&
      other.className === this.className &&
      other.label === this.label
    );
  }

  toDOM() {
    const marker = document.createElement("span");
    marker.className = this.className;
    marker.textContent = this.text;
    if (this.label) marker.setAttribute("aria-label", this.label);
    else marker.setAttribute("aria-hidden", "true");
    return marker;
  }
}

export class TaskMarkerWidget extends WidgetType {
  constructor(
    private readonly from: number,
    private readonly to: number,
    private readonly checked: boolean,
  ) {
    super();
  }

  eq(other: TaskMarkerWidget) {
    return (
      other.from === this.from &&
      other.to === this.to &&
      other.checked === this.checked
    );
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement("button");
    checkbox.type = "button";
    checkbox.className = "cm-live-task";
    checkbox.contentEditable = "false";
    checkbox.setAttribute("role", "checkbox");
    checkbox.setAttribute("aria-checked", String(this.checked));
    checkbox.setAttribute(
      "aria-label",
      this.checked ? "علامت‌گذاری به‌عنوان انجام‌نشده" : "علامت‌گذاری به‌عنوان انجام‌شده",
    );
    checkbox.title = checkbox.getAttribute("aria-label") ?? "";
    checkbox.textContent = this.checked ? "✓" : "";
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        changes: {
          from: this.from,
          to: this.to,
          insert: this.checked ? "[ ]" : "[x]",
        },
        effects: EditorView.announce.of(
          this.checked ? "کار انجام‌نشده شد" : "کار انجام‌شده شد",
        ),
      });
      view.focus();
    });
    return checkbox;
  }

  ignoreEvent() {
    return true;
  }
}

export class RevealSourceWidget extends WidgetType {
  constructor(
    private readonly from: number,
    private readonly to: number,
    private readonly label: string,
    private readonly className: string,
  ) {
    super();
  }

  eq(other: RevealSourceWidget) {
    return (
      other.from === this.from &&
      other.to === this.to &&
      other.label === this.label &&
      other.className === this.className
    );
  }

  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = this.className;
    button.contentEditable = "false";
    button.textContent = this.label;
    button.title = "نمایش متن Markdown";
    button.setAttribute("aria-label", `${this.label}؛ نمایش متن Markdown`);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        selection: { anchor: this.from, head: this.to },
        effects: EditorView.scrollIntoView(this.from, { y: "nearest" }),
      });
      view.focus();
    });
    return button;
  }

  ignoreEvent() {
    return true;
  }
}

export class HorizontalRuleWidget extends WidgetType {
  constructor(
    private readonly from: number,
    private readonly to: number,
  ) {
    super();
  }

  eq(other: HorizontalRuleWidget) {
    return other.from === this.from && other.to === this.to;
  }

  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-live-horizontal-rule";
    button.contentEditable = "false";
    button.setAttribute("aria-label", "خط جداکننده؛ نمایش متن Markdown");
    button.title = "خط جداکننده؛ برای ویرایش کلیک کنید";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({ selection: { anchor: this.from, head: this.to } });
      view.focus();
    });
    return button;
  }

  ignoreEvent() {
    return true;
  }
}

type LinkDescriptor = {
  from: number;
  to: number;
  urlFrom: number;
  urlTo: number;
  url: string;
};

let linkPopoverId = 0;

export function safeExternalLink(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//iu.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function validateMarkdownLinkDestination(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "نشانی پیوند نمی‌تواند خالی باشد.";
  if (trimmed.length > 2_048) return "نشانی پیوند بیش از اندازه بلند است.";
  if (/[\r\n\u0000-\u001f]/u.test(trimmed)) {
    return "نشانی پیوند نباید خط تازه یا نویسهٔ کنترلی داشته باشد.";
  }
  return "";
}

export function createLiveLinkPopoverExtension() {
  return ViewPlugin.fromClass(
    class {
      private readonly dom = document.createElement("div");
      private readonly input = document.createElement("input");
      private readonly error = document.createElement("small");
      private readonly openLink = document.createElement("a");
      private descriptor: LinkDescriptor | null = null;
      private readonly onEditorClick: (event: MouseEvent) => void;
      private readonly onDocumentPointerDown: (event: PointerEvent) => void;

      constructor(private readonly view: EditorView) {
        linkPopoverId += 1;
        const titleId = `cm-live-link-title-${linkPopoverId}`;
        const inputId = `cm-live-link-input-${linkPopoverId}`;
        const errorId = `cm-live-link-error-${linkPopoverId}`;

        this.dom.className = "cm-live-link-popover";
        this.dom.contentEditable = "false";
        this.dom.hidden = true;
        this.dom.setAttribute("role", "dialog");
        this.dom.setAttribute("aria-labelledby", titleId);

        const header = document.createElement("div");
        header.className = "cm-live-link-popover-header";
        const title = document.createElement("strong");
        title.id = titleId;
        title.textContent = "ویرایش پیوند";
        const close = document.createElement("button");
        close.type = "button";
        close.className = "cm-live-link-popover-close";
        close.textContent = "×";
        close.setAttribute("aria-label", "بستن ویرایش پیوند");
        close.addEventListener("click", () => this.close(true));
        header.append(title, close);

        const label = document.createElement("label");
        label.htmlFor = inputId;
        label.textContent = "نشانی";
        this.input.id = inputId;
        this.input.dir = "ltr";
        this.input.type = "text";
        this.input.maxLength = 2_048;
        this.input.autocomplete = "off";
        this.input.dataset.editableKind = "generic";
        this.input.setAttribute("aria-describedby", errorId);
        label.append(this.input);

        this.error.id = errorId;
        this.error.className = "cm-live-link-popover-error";
        this.error.setAttribute("aria-live", "polite");

        const actions = document.createElement("div");
        actions.className = "cm-live-link-popover-actions";
        this.openLink.className = "cm-live-link-open";
        this.openLink.textContent = "بازکردن پیوند";
        this.openLink.target = "_blank";
        this.openLink.rel = "noopener noreferrer";
        const save = document.createElement("button");
        save.type = "button";
        save.className = "cm-live-link-save";
        save.textContent = "ثبت نشانی";
        save.addEventListener("click", () => this.save());
        actions.append(this.openLink, save);
        this.dom.append(header, label, this.error, actions);
        view.dom.append(this.dom);

        this.input.addEventListener("input", () => this.refreshValidation());
        this.dom.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            this.close(true);
          } else if (event.key === "Enter" && event.target === this.input) {
            event.preventDefault();
            this.save();
          }
        });

        this.onEditorClick = (event) => {
          if (!(event.target instanceof Element)) return;
          const link = event.target.closest<HTMLElement>(".cm-live-link");
          if (!link || !view.contentDOM.contains(link)) return;
          const from = Number(link.dataset.liveLinkFrom);
          const to = Number(link.dataset.liveLinkTo);
          const urlFrom = Number(link.dataset.liveLinkUrlFrom);
          const urlTo = Number(link.dataset.liveLinkUrlTo);
          const url = link.dataset.liveLinkUrl ?? "";
          if (![from, to, urlFrom, urlTo].every(Number.isFinite)) return;
          this.open(link, { from, to, urlFrom, urlTo, url });
        };
        this.onDocumentPointerDown = (event) => {
          if (this.dom.hidden || !(event.target instanceof Node)) return;
          if (this.dom.contains(event.target)) return;
          const element = event.target instanceof Element ? event.target : null;
          const link = element?.closest(".cm-live-link");
          if (link && view.contentDOM.contains(link)) return;
          this.close(false);
        };
        view.dom.addEventListener("click", this.onEditorClick);
        document.addEventListener("pointerdown", this.onDocumentPointerDown);
      }

      update(update: { docChanged: boolean; viewportChanged: boolean }) {
        if (update.docChanged || update.viewportChanged) this.close(false);
      }

      private open(target: HTMLElement, descriptor: LinkDescriptor) {
        this.descriptor = descriptor;
        this.input.value = descriptor.url;
        this.error.textContent = "";
        this.dom.hidden = false;
        this.refreshValidation();

        const rootRect = this.view.dom.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const width = Math.min(320, Math.max(240, rootRect.width - 16));
        this.dom.style.width = `${width}px`;
        const left = Math.max(
          8,
          Math.min(targetRect.left - rootRect.left, rootRect.width - width - 8),
        );
        const below = targetRect.bottom - rootRect.top + 8;
        const popoverHeight = this.dom.offsetHeight || 154;
        const top =
          below + popoverHeight <= rootRect.height - 8
            ? below
            : Math.max(8, targetRect.top - rootRect.top - popoverHeight - 8);
        this.dom.style.left = `${left}px`;
        this.dom.style.top = `${top}px`;
        queueMicrotask(() => {
          this.input.focus();
          this.input.select();
        });
      }

      private refreshValidation() {
        const message = validateMarkdownLinkDestination(this.input.value);
        this.error.textContent = message;
        this.input.setAttribute("aria-invalid", String(Boolean(message)));
        const external = safeExternalLink(this.input.value);
        this.openLink.hidden = !external;
        if (external) this.openLink.href = external;
        else this.openLink.removeAttribute("href");
      }

      private save() {
        if (!this.descriptor) return;
        const url = this.input.value.trim();
        const message = validateMarkdownLinkDestination(url);
        if (message) {
          this.refreshValidation();
          this.input.focus();
          return;
        }
        const { from, urlFrom, urlTo } = this.descriptor;
        this.view.dispatch({
          changes: { from: urlFrom, to: urlTo, insert: url },
          selection: { anchor: from + 1 },
          effects: EditorView.announce.of("نشانی پیوند ثبت شد"),
        });
        this.view.focus();
      }

      private close(restoreFocus: boolean) {
        this.dom.hidden = true;
        this.descriptor = null;
        if (restoreFocus) this.view.focus();
      }

      destroy() {
        this.view.dom.removeEventListener("click", this.onEditorClick);
        document.removeEventListener("pointerdown", this.onDocumentPointerDown);
        this.dom.remove();
      }
    },
  );
}
