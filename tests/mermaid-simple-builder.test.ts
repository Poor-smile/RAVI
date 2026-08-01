import assert from "node:assert/strict";
import test from "node:test";
import {
  createSimpleDiagramDraft,
  parseSimpleDiagram,
  SIMPLE_DIAGRAM_OPTIONS,
  simpleDraftToCode,
  supportsDiagramOrientation,
  validateSimpleDiagramDraft,
} from "../app/mermaid/simple-builder";
import {
  detectMermaidKind,
  prepareMermaidForRender,
} from "../app/mermaid/persian-adapter";

test("ships an easy builder for every Mermaid type in the library", () => {
  assert.deepEqual(
    SIMPLE_DIAGRAM_OPTIONS.map((option) => option.kind),
    [
      "flowchart",
      "sequence",
      "class",
      "state",
      "er",
      "requirement",
      "architecture",
      "c4",
      "gantt",
      "timeline",
      "kanban",
      "gitgraph",
      "pie",
      "xychart",
      "sankey",
      "mindmap",
      "journey",
      "quadrant",
      "swimlane",
      "block",
      "packet",
      "radar",
      "eventmodeling",
      "treemap",
      "venn",
      "ishikawa",
      "wardley",
      "cynefin",
      "treeview",
    ],
  );
});

for (const option of SIMPLE_DIAGRAM_OPTIONS) {
  test(`generates and reopens a simple ${option.kind} draft`, () => {
    const draft = createSimpleDiagramDraft(option.kind);
    const code = simpleDraftToCode(draft);
    assert.equal(detectMermaidKind(code), option.kind);
    const parsed = parseSimpleDiagram(code);
    assert.ok(parsed);
    assert.equal(parsed.kind, option.kind);
    assert.equal(parsed.orientation, draft.orientation);
    assert.ok(parsed.rows.length > 0);
  });
}

test("supports width and length orientation for network diagrams", () => {
  const directional = SIMPLE_DIAGRAM_OPTIONS.filter((option) =>
    supportsDiagramOrientation(option.kind),
  );
  assert.deepEqual(
    directional.map((option) => option.kind),
    ["flowchart", "class", "state", "er", "requirement", "architecture", "timeline", "gitgraph", "xychart", "swimlane"],
  );

  const flowchart = createSimpleDiagramDraft("flowchart");
  assert.match(simpleDraftToCode(flowchart), /^flowchart RL/mu);
  assert.match(
    simpleDraftToCode({ ...flowchart, orientation: "vertical" }),
    /^flowchart TB/mu,
  );
});

test("keeps the expanded settings and row details when reopening a draft", () => {
  const draft = createSimpleDiagramDraft("c4");
  draft.settings.c4Level = "component";
  draft.rows[0].meta.targetType = "ComponentDb";
  draft.rows[0].meta.boundary = "مرز داخلی";
  const parsed = parseSimpleDiagram(simpleDraftToCode(draft));
  assert.ok(parsed);
  assert.equal(parsed.settings.c4Level, "component");
  assert.equal(parsed.rows[0].meta.targetType, "ComponentDb");
  assert.equal(parsed.rows[0].meta.boundary, "مرز داخلی");
});

test("validates the documented numeric boundaries before applying", () => {
  const pie = createSimpleDiagramDraft("pie");
  pie.rows[0].value = "۰";
  assert.match(validateSimpleDiagramDraft(pie)[0]?.message ?? "", /بزرگ‌تر از صفر/u);

  const journey = createSimpleDiagramDraft("journey");
  journey.rows[0].value = "۰";
  assert.match(validateSimpleDiagramDraft(journey)[0]?.message ?? "", /بین ۱ تا ۵/u);

  const quadrant = createSimpleDiagramDraft("quadrant");
  quadrant.rows[0].second = "۱٫۲";
  assert.match(validateSimpleDiagramDraft(quadrant)[0]?.message ?? "", /بین ۰ و ۱/u);
});

test("preserves Persian Git branch names instead of replacing them with generic ids", () => {
  const draft = createSimpleDiagramDraft("gitgraph");
  const code = simpleDraftToCode(draft);
  assert.match(code, /branch "ویژگی"/u);
  assert.doesNotMatch(code, /branch1/u);
});

test("generates standard numeric syntax while keeping Persian labels", () => {
  const pie = createSimpleDiagramDraft("pie");
  const pieCode = simpleDraftToCode(pie);
  assert.match(pieCode, /"بخش اول" : 60/u);

  const sankey = createSimpleDiagramDraft("sankey");
  const sankeyCode = simpleDraftToCode(sankey);
  assert.match(sankeyCode, /"ورودی","مطالعه",8/u);
  const prepared = prepareMermaidForRender(sankeyCode);
  assert.match(prepared.code, /RAAVI_FA_1,RAAVI_FA_2,8/u);
});

test("keeps both layout dimensions controllable in the new easy builders", () => {
  const packet = createSimpleDiagramDraft("packet");
  packet.settings.bitsPerRow = "۱۶";
  assert.match(simpleDraftToCode(packet), /bitsPerRow: 16/u);

  const block = createSimpleDiagramDraft("block");
  block.settings.columns = "۲";
  block.rows[0].meta.sourceWidth = "2";
  const blockCode = simpleDraftToCode(block);
  assert.match(blockCode, /columns 2/u);
  assert.match(blockCode, /block1\["ویرایشگر"\]:2/u);
});
