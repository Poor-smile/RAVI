import type { MermaidComplexity } from "./complexity";
import type {
  MermaidRenderError,
  MermaidRenderMetrics,
  MermaidTheme,
} from "./renderer";
import { recordMermaidMeasure } from "./performance";

export type MermaidRenderPriority = "interactive" | "visible" | "prefetch";

export type MermaidRenderJob = {
  id: string;
  documentId: string;
  blockId: string;
  code: string;
  theme: MermaidTheme;
  priority: MermaidRenderPriority;
  generation: number;
  complexity: MermaidComplexity;
};

export type MermaidRendererOutput =
  | {
      ok: true;
      svg: string;
      metrics: MermaidRenderMetrics;
      complexity: MermaidComplexity;
    }
  | { ok: false; error: MermaidRenderError; metrics: MermaidRenderMetrics };

export interface MermaidRendererTransport {
  render(job: MermaidRenderJob): Promise<MermaidRendererOutput>;
  restart(reason: "timeout" | "crash" | "superseded"): Promise<void>;
  dispose?(): Promise<void>;
}

type Consumer = {
  job: MermaidRenderJob;
  enqueuedAt: number;
  resolve: (result: MermaidRendererOutput) => void;
};

type ScheduledTask = {
  key: string;
  consumers: Consumer[];
  priority: MermaidRenderPriority;
  sequence: number;
};

const PRIORITY_WEIGHT: Record<MermaidRenderPriority, number> = {
  interactive: 3,
  visible: 2,
  prefetch: 1,
};

function controlledError(
  kind: MermaidRenderError["kind"],
  message: string,
  technical: string,
): MermaidRendererOutput {
  return {
    ok: false,
    error: { kind, message, technical },
    metrics: {},
  };
}

export class MermaidRenderScheduler {
  private pending: ScheduledTask[] = [];
  private current: ScheduledTask | null = null;
  private sequence = 0;
  private running = false;
  private latestGeneration = new Map<string, number>();
  private cancelCurrent: ((reason: "superseded") => void) | null = null;

  constructor(
    private readonly transport: MermaidRendererTransport,
    private readonly timeoutMs = 5_000,
  ) {}

  schedule(job: MermaidRenderJob, dedupeKey: string) {
    const blockKey = `${job.documentId}:${job.blockId}`;
    this.latestGeneration.set(blockKey, job.generation);

    return new Promise<MermaidRendererOutput>((resolve) => {
      const consumer = { job, resolve, enqueuedAt: performance.now() };
      this.cancelOlderPending(blockKey, job.generation);

      if (this.current?.key === dedupeKey) {
        this.current.consumers.push(consumer);
        this.current.priority = this.higherPriority(this.current.priority, job.priority);
        return;
      }

      const existing = this.pending.find((task) => task.key === dedupeKey);
      if (existing) {
        existing.consumers.push(consumer);
        existing.priority = this.higherPriority(existing.priority, job.priority);
      } else {
        this.pending.push({
          key: dedupeKey,
          consumers: [consumer],
          priority: job.priority,
          sequence: this.sequence++,
        });
      }

      if (
        this.current &&
        this.current.key !== dedupeKey &&
        this.current.consumers.every(
          ({ job: active }) =>
            `${active.documentId}:${active.blockId}` === blockKey &&
            active.generation < job.generation,
        )
      ) {
        this.cancelCurrent?.("superseded");
      }
      void this.drain();
    });
  }

  async dispose() {
    await this.transport.dispose?.();
  }

  private cancelOlderPending(blockKey: string, generation: number) {
    for (const task of this.pending) {
      const retained: Consumer[] = [];
      for (const consumer of task.consumers) {
        const candidateKey = `${consumer.job.documentId}:${consumer.job.blockId}`;
        if (candidateKey === blockKey && consumer.job.generation < generation) {
          consumer.resolve(
            controlledError(
              "cancelled",
              "درخواست قدیمی نمودار کنار گذاشته شد.",
              "Superseded by a newer generation",
            ),
          );
        } else retained.push(consumer);
      }
      task.consumers = retained;
    }
    this.pending = this.pending.filter((task) => task.consumers.length > 0);
  }

  private higherPriority(
    left: MermaidRenderPriority,
    right: MermaidRenderPriority,
  ) {
    return PRIORITY_WEIGHT[right] > PRIORITY_WEIGHT[left] ? right : left;
  }

  private takeNext() {
    this.pending.sort(
      (left, right) =>
        PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
        left.sequence - right.sequence,
    );
    return this.pending.shift() ?? null;
  }

  private async drain() {
    if (this.running) return;
    this.running = true;
    try {
      while ((this.current = this.takeNext())) {
        const task = this.current;
        const representativeConsumer = task.consumers[task.consumers.length - 1];
        const representative = representativeConsumer.job;
        const queueWait = Math.max(
          0,
          performance.now() - representativeConsumer.enqueuedAt,
        );
        recordMermaidMeasure(
          representative.id,
          "queueWait",
          representativeConsumer.enqueuedAt,
          queueWait,
        );
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        let cancel: ((reason: "superseded") => void) | undefined;
        const cancelPromise = new Promise<MermaidRendererOutput>((resolve) => {
          cancel = (reason) => {
            void this.transport.restart(reason).catch(() => {}).finally(() => {
              resolve(
                controlledError(
                  "cancelled",
                  "رندر قدیمی متوقف شد.",
                  "Renderer context restarted for a newer generation",
                ),
              );
            });
          };
        });
        this.cancelCurrent = cancel ?? null;
        const timeoutPromise = new Promise<MermaidRendererOutput>((resolve) => {
          timeoutHandle = setTimeout(() => {
            void this.transport.restart("timeout").catch(() => {}).finally(() => {
              resolve(
                controlledError(
                  "timeout",
                  "رندر نمودار بیش از حد طول کشید و متوقف شد.",
                  `مهلت رندر ${this.timeoutMs} میلی‌ثانیه است.`,
                ),
              );
            });
          }, this.timeoutMs);
        });

        let result: MermaidRendererOutput;
        try {
          result = await Promise.race([
            this.transport.render(representative),
            timeoutPromise,
            cancelPromise,
          ]);
        } catch (error) {
          result = controlledError(
            "renderer-crash",
            "موتور نمودار دوباره راه‌اندازی شد.",
            error instanceof Error ? error.message : String(error),
          );
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          this.cancelCurrent = null;
        }
        if (!result.ok && result.error.kind === "renderer-crash") {
          await this.transport.restart("crash").catch(() => {});
        }
        result.metrics.queueWait = queueWait;

        for (const consumer of task.consumers) {
          const consumerKey = `${consumer.job.documentId}:${consumer.job.blockId}`;
          if (this.latestGeneration.get(consumerKey) !== consumer.job.generation) {
            consumer.resolve(
              controlledError(
                "cancelled",
                "نتیجهٔ قدیمی نمودار نادیده گرفته شد.",
                "Stale generation",
              ),
            );
          } else consumer.resolve(result);
        }
        this.current = null;
      }
    } finally {
      this.current = null;
      this.running = false;
      if (this.pending.length > 0) void this.drain();
    }
  }
}
