// Every network wait is bounded, including fetch implementations that ignore abort.
export async function withUpdateResponse(url, options, consume) {
  const { fetchImpl, signal, headerTimeoutMs, idleTimeoutMs, totalTimeoutMs, headers } = options;
  const controller = new AbortController();
  const abort = () => controller.abort(signal.reason ?? new Error("update_aborted"));
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const expiresAt = Date.now() + totalTimeoutMs;
  const deadline = setTimeout(() => controller.abort(new Error("update_total_timeout")), totalTimeoutMs);
  let response;
  let reader;
  function wait(operation, timeoutMs, code) {
    return new Promise((resolve, reject) => {
      const onAbort = () => finish(reject, controller.signal.reason);
      const timer = setTimeout(() => controller.abort(new Error(code)), timeoutMs);
      function finish(callback, value) {
        clearTimeout(timer);
        controller.signal.removeEventListener("abort", onAbort);
        callback(value);
      }
      controller.signal.addEventListener("abort", onAbort, { once: true });
      Promise.resolve(operation).then((value) => finish(resolve, value), (error) => finish(reject, error));
      if (controller.signal.aborted) onAbort();
    });
  }
  async function* chunks() {
    if (!response.body) throw new Error("update_missing_body");
    reader = response.body.getReader();
    let idleDeadline = Date.now() + idleTimeoutMs;
    for (;;) {
      // Also check the clock directly: empty, immediately resolved reads must
      // not evade deadlines by keeping the microtask queue continuously busy.
      if (Date.now() >= expiresAt) controller.abort(new Error("update_total_timeout"));
      if (Date.now() >= idleDeadline) controller.abort(new Error("update_idle_timeout"));
      controller.signal.throwIfAborted();
      const { done, value } = await wait(reader.read(), idleTimeoutMs, "update_idle_timeout");
      if (done) return;
      if (value.byteLength) {
        idleDeadline = Date.now() + idleTimeoutMs;
        yield Buffer.from(value);
      }
    }
  }
  try {
    let destination = new URL(url);
    for (let redirects = 0; ; redirects += 1) {
      controller.signal.throwIfAborted();
      if (destination.protocol !== "https:") throw new Error("update_insecure_url");
      const request = Promise.resolve().then(() => fetchImpl(destination.toString(), {
        headers,
        signal: controller.signal,
        cache: "no-store",
        redirect: "manual",
      }));
      // Close a response that arrives after cancellation or a deadline.
      void request.then((late) => {
        if (controller.signal.aborted) void late.body?.cancel().catch(() => {});
      }, () => {});
      response = await wait(request, headerTimeoutMs, "update_header_timeout");
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      void response.body?.cancel().catch(() => {});
      if (redirects >= 3 || !response.headers.get("location")) throw new Error("update_invalid_redirect");
      destination = new URL(response.headers.get("location"), destination);
    }
    return await consume(response, chunks, controller.signal);
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", abort);
    controller.abort(new Error("update_request_finished"));
    if (reader) {
      void reader.cancel().catch(() => {});
      reader.releaseLock();
    } else {
      void response?.body?.cancel().catch(() => {});
    }
  }
}

export function responseLength(response) {
  const value = response.headers.get("content-length");
  if (value === null) return null;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("update_invalid_content_length");
  }
  return Number(value);
}
