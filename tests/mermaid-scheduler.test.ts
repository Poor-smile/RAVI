import assert from "node:assert/strict";
import test from "node:test";
import { createMermaidBlobUrl } from "../app/mermaid/blob-url";
import { MermaidMemoryCache } from "../app/mermaid/cache";
import { estimateMermaidComplexity } from "../app/mermaid/complexity";
import {
  MermaidRenderScheduler,
  type MermaidRenderJob,
  type MermaidRendererOutput,
  type MermaidRendererTransport,
  type MermaidRenderPriority,
} from "../app/mermaid/scheduler";

const complexity = estimateMermaidComplexity("flowchart TD\nA-->B");
const success: MermaidRendererOutput = {
  ok: true,
  svg: "<svg />",
  complexity,
  metrics: {},
};

function job(
  id: string,
  priority: MermaidRenderPriority,
  generation = 1,
  blockId = id,
): MermaidRenderJob {
  return {
    id,
    documentId: "document",
    blockId,
    code: `flowchart TD\n${id}-->B`,
    theme: "light",
    priority,
    generation,
    complexity,
  };
}

test("scheduler prioritizes interactive, deduplicates, and keeps latest generation", async () => {
  const order: string[] = [];
  let releaseFirst = () => {};
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const transport: MermaidRendererTransport = {
    async render(next) {
      order.push(next.id);
      if (next.id === "first") await firstGate;
      return success;
    },
    async restart() {},
  };
  const scheduler = new MermaidRenderScheduler(transport, 1_000);
  const first = scheduler.schedule(job("first", "visible"), "first-key");
  const prefetch = scheduler.schedule(job("prefetch", "prefetch"), "prefetch-key");
  const visible = scheduler.schedule(job("visible", "visible"), "visible-key");
  const interactiveJob = job("interactive", "interactive", 1, "shared");
  const duplicate = job("duplicate", "interactive", 2, "shared");
  const stale = scheduler.schedule(interactiveJob, "dedupe-key");
  const latest = scheduler.schedule(duplicate, "dedupe-key");
  releaseFirst();
  const [staleResult, latestResult] = await Promise.all([
    stale,
    latest,
    first,
    prefetch,
    visible,
  ]).then(([oldResult, newResult]) => [oldResult, newResult]);

  assert.deepEqual(order, ["first", "duplicate", "visible", "prefetch"]);
  assert.equal(staleResult.ok, false);
  if (!staleResult.ok) assert.equal(staleResult.error.kind, "cancelled");
  assert.equal(latestResult.ok, true);
});

test("timeout destroys the renderer context and the following job runs", async () => {
  const starts: string[] = [];
  let restarts = 0;
  const transport: MermaidRendererTransport = {
    async render(next) {
      starts.push(next.id);
      if (next.id === "hung") return new Promise(() => {});
      return success;
    },
    async restart() {
      restarts += 1;
    },
  };
  const scheduler = new MermaidRenderScheduler(transport, 20);
  const timedOut = scheduler.schedule(job("hung", "interactive"), "hung");
  const recovered = scheduler.schedule(job("small", "visible"), "small");
  const [timeoutResult, recoveryResult] = await Promise.all([timedOut, recovered]);
  assert.equal(timeoutResult.ok, false);
  if (!timeoutResult.ok) assert.equal(timeoutResult.error.kind, "timeout");
  assert.equal(recoveryResult.ok, true);
  assert.deepEqual(starts, ["hung", "small"]);
  assert.equal(restarts, 1);
});

test("renderer crash restarts the transport and does not poison the queue", async () => {
  let calls = 0;
  let restarts = 0;
  const scheduler = new MermaidRenderScheduler(
    {
      async render() {
        calls += 1;
        if (calls === 1) throw new Error("renderer crashed");
        return success;
      },
      async restart() {
        restarts += 1;
      },
    },
    100,
  );
  const crashed = scheduler.schedule(job("crash", "visible"), "crash");
  const recovered = scheduler.schedule(job("recovery", "visible"), "recovery");
  const [crashResult, recoveryResult] = await Promise.all([crashed, recovered]);
  assert.equal(crashResult.ok, false);
  if (!crashResult.ok) assert.equal(crashResult.error.kind, "renderer-crash");
  assert.equal(recoveryResult.ok, true);
  assert.equal(restarts, 1);
});

test("queue recovers after ten consecutive renderer timeouts", async () => {
  let restarts = 0;
  const scheduler = new MermaidRenderScheduler(
    {
      async render(next) {
        if (next.id.startsWith("timeout")) return new Promise(() => {});
        return success;
      },
      async restart() {
        restarts += 1;
      },
    },
    5,
  );
  const timedOut = Array.from({ length: 10 }, (_, index) =>
    scheduler.schedule(job(`timeout-${index}`, "interactive"), `timeout-${index}`),
  );
  const recovery = scheduler.schedule(job("healthy", "visible"), "healthy");
  const results = await Promise.all([...timedOut, recovery]);
  for (const result of results.slice(0, 10)) {
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error.kind, "timeout");
  }
  assert.equal(results[10].ok, true);
  assert.equal(restarts, 10);
});

test("complexity guard distinguishes dense diagrams from long simple text", () => {
  const dense = estimateMermaidComplexity(
    [
      "flowchart LR",
      ...Array.from({ length: 950 }, (_, index) =>
        `N${index}-->N${index + 1}`,
      ),
    ].join("\n"),
  );
  const simple = estimateMermaidComplexity(
    `flowchart LR\nA["${"متن ".repeat(2_000)}"]`,
  );
  assert.equal(dense.level, "extreme");
  assert.equal(simple.level, "normal");
  assert.ok(dense.edges > simple.edges);
});

test("byte LRU evicts unpinned entries and never exceeds its memory budget", () => {
  const cache = new MermaidMemoryCache(34);
  cache.set("a", "<svg>aaaa</svg>", complexity);
  cache.set("b", "<svg>bbbb</svg>", complexity);
  cache.pin("b");
  cache.set("c", "<svg>cccc</svg>", complexity);
  assert.equal(cache.peek("a"), undefined);
  assert.ok(cache.peek("b"));
  assert.ok(cache.stats().totalBytes <= cache.stats().maxBytes);
  assert.ok(cache.stats().evictions >= 1);
});

test("Blob URL ownership revokes the URL exactly once", () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.createObjectURL = () => "blob:raavi-test";
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const blob = createMermaidBlobUrl("<svg />");
    assert.equal(blob?.url, "blob:raavi-test");
    blob?.revoke();
    blob?.revoke();
    assert.deepEqual(revoked, ["blob:raavi-test"]);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
