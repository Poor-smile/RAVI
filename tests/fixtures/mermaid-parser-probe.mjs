import mermaid from "mermaid";

console.log(JSON.stringify({ ready: true }));

const source = process.argv[2] === "degenerate"
  ? "xychart\n  x-axis 1 --> 1\n  line [1, 2]"
  : "xychart\n  x-axis 1 --> 2\n  line [1, 2]";
mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
try {
  await mermaid.parse(source);
  console.log(JSON.stringify({ parsed: true }));
} catch (error) {
  console.log(JSON.stringify({ parsed: false, error: String(error) }));
}
