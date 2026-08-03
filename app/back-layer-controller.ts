export type BackLayerDismiss = () => void;

export interface BackLayerHistoryPort {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  back(): void;
}
export interface BackLayerEventPort {
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

export interface BackLayerScheduler {
  microtask(callback: () => void): void;
}

type BackLayerEntry = {
  id: string;
  dismiss: BackLayerDismiss;
};

const HISTORY_MARKER = "__raaviBackLayerGuard";

function withGuard(state: unknown, token: string) {
  const current =
    state && typeof state === "object" && !Array.isArray(state)
      ? (state as Record<string, unknown>)
      : {};
  return { ...current, [HISTORY_MARKER]: token };
}

function withoutGuard(state: unknown) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return state;
  const next = { ...(state as Record<string, unknown>) };
  delete next[HISTORY_MARKER];
  return next;
}

/**
 * Keeps one same-document history guard in front of the current route while
 * transient UI is open. Every Back press dismisses only the newest layer.
 */
export class BackLayerController {
  private readonly entries: BackLayerEntry[] = [];
  private readonly token = `raavi-${Math.random().toString(36).slice(2)}`;
  private started = false;
  private guardActive = false;
  private suppressNextPop = false;
  private removalVersion = 0;

  constructor(
    private readonly history: BackLayerHistoryPort,
    private readonly events: BackLayerEventPort,
    private readonly scheduler: BackLayerScheduler,
  ) {}

  readonly handlePopState = () => {
    if (this.suppressNextPop) {
      this.suppressNextPop = false;
      return;
    }
    if (!this.guardActive || this.entries.length === 0) return;

    // Back already removed the current guard. Replace it synchronously before
    // asking React to close the top layer, so rapid repeated Back presses cannot
    // escape the document while a transient surface is still visible.
    this.guardActive = false;
    this.pushGuard();
    this.entries.at(-1)?.dismiss();
  };

  start() {
    if (this.started) return;
    this.started = true;
    this.events.addEventListener("popstate", this.handlePopState);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.events.removeEventListener("popstate", this.handlePopState);
    this.removalVersion += 1;
    if (this.guardActive) {
      this.history.replaceState(withoutGuard(this.history.state), "");
      this.guardActive = false;
    }
    this.entries.length = 0;
  }

  register(id: string, dismiss: BackLayerDismiss) {
    const existing = this.entries.find((entry) => entry.id === id);
    if (existing) {
      existing.dismiss = dismiss;
      return () => this.unregister(id);
    }

    this.removalVersion += 1;
    this.entries.push({ id, dismiss });
    if (!this.guardActive) this.pushGuard();
    return () => this.unregister(id);
  }

  private unregister(id: string) {
    const index = this.entries.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    this.entries.splice(index, 1);
    if (this.entries.length !== 0 || !this.guardActive) return;

    // React may replace one surface with another in the same commit (for
    // example mobile menu -> new-document dialog). Defer guard removal until
    // all passive effects for that commit have registered their replacement.
    const version = ++this.removalVersion;
    this.scheduler.microtask(() => {
      if (
        version !== this.removalVersion ||
        this.entries.length !== 0 ||
        !this.guardActive
      ) {
        return;
      }
      this.guardActive = false;
      this.suppressNextPop = true;
      this.history.back();
    });
  }

  private pushGuard() {
    this.history.pushState(withGuard(this.history.state, this.token), "");
    this.guardActive = true;
  }
}
