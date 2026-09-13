import type { Plugin } from "vite";

// micromark 4's text resolver repeatedly splices the remaining event array.
// A long paragraph with many data runs makes this quadratic. Compact in place
// instead, preserving the first enter/exit events, token identity, and suffix
// resolution exactly. Keep this guarded patch explicit across dependency updates.
export function linearizeMicromarkData(source: string) {
  const normalized = source.replace(/\r\n/g, "\n");
  const start = normalized.indexOf("  function resolveAllText(events, context) {");
  const tail = "    return extraResolver ? extraResolver(events, context) : events;\n  }";
  const end = normalized.indexOf(tail, start);
  if (start < 0 || end < 0 || !normalized.slice(start, end).includes("events.splice(enter + 2, index - enter - 2)")) {
    throw new Error("micromark text resolver changed; revalidate its linear compaction patch.");
  }
  const replacement = `  function resolveAllText(events, context) {
    const length = events.length;
    let read = 0;
    let write = 0;
    while (read < length) {
      const first = events[read];
      if (first[1].type !== "data") {
        events[write++] = first;
        read++;
        continue;
      }
      const second = events[read + 1];
      let end = read + 2;
      while (end < length && events[end][1].type === "data") end++;
      if (end > read + 2) first[1].end = events[end - 1][1].end;
      events[write++] = first;
      if (second) events[write++] = second;
      read = end;
    }
    events.length = write;
    return extraResolver ? extraResolver(events, context) : events;
  }`;
  return normalized.slice(0, start) + replacement + normalized.slice(end + tail.length);
}

export function micromarkLinearDataPlugin(): Plugin {
  return {
    name: "micromark-linear-data",
    enforce: "pre",
    transform(source, id) {
      if (!/\/micromark\/(?:dev\/)?lib\/initialize\/text\.js(?:\?|$)/u.test(id.replace(/\\/g, "/"))) return;
      return { code: linearizeMicromarkData(source), map: null };
    },
  };
}
