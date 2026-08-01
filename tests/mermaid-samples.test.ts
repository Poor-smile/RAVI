import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  findMermaidBlocks,
  insertMermaidBlock,
} from "../app/mermaid/blocks";
import { MERMAID_SAMPLES } from "../app/mermaid/samples";
import {
  MERMAID_LIMITS,
  renderMermaid,
  sanitizeMermaidSvg,
} from "../app/mermaid/renderer";
import { prepareMermaidForRender } from "../app/mermaid/persian-adapter";
import {
  createSimpleDiagramDraft,
  SIMPLE_DIAGRAM_OPTIONS,
  simpleDraftToCode,
  supportsDiagramOrientation,
} from "../app/mermaid/simple-builder";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
  Element: dom.window.Element,
  Node: dom.window.Node,
});
const mermaid = (await import("mermaid")).default;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  htmlLabels: false,
  suppressErrorRendering: true,
});

for (const sample of MERMAID_SAMPLES) {
  test(`sample parses and round-trips without changing its source: ${sample.id}`, async () => {
    const prepared = prepareMermaidForRender(sample.code);
    const result = await mermaid.parse(prepared.code, { suppressErrors: false });
    assert.equal(typeof result.diagramType, "string");
    assert.ok(result.diagramType.length > 0);

    const inserted = insertMermaidBlock("", 0, sample.code);
    const [block] = findMermaidBlocks(inserted.content);
    assert.ok(block);
    assert.equal(block.code, sample.code);
  });
}

for (const option of SIMPLE_DIAGRAM_OPTIONS) {
  test(`easy builder emits valid Mermaid syntax: ${option.kind}`, async () => {
    const draft = createSimpleDiagramDraft(option.kind);
    const orientations = supportsDiagramOrientation(option.kind)
      ? (["horizontal", "vertical"] as const)
      : (["horizontal"] as const);
    for (const orientation of orientations) {
      const code = simpleDraftToCode({ ...draft, orientation });
      const prepared = prepareMermaidForRender(code);
      const result = await mermaid.parse(prepared.code, { suppressErrors: false });
      assert.equal(typeof result.diagramType, "string");
    }
  });
}

test("expanded easy-builder controls emit valid Mermaid syntax", async () => {
  const drafts: ReturnType<typeof createSimpleDiagramDraft>[] = [];

  const flowchart = createSimpleDiagramDraft("flowchart");
  Object.assign(flowchart.rows[0].meta, {
    sourceShape: "stadium",
    targetShape: "diamond",
    linkType: "dotted",
    sourceGroup: "ورودی",
    targetGroup: "تصمیم‌گیری",
  });
  drafts.push(flowchart);

  const sequence = createSimpleDiagramDraft("sequence");
  Object.assign(sequence.rows[0].meta, {
    sourceType: "actor",
    targetType: "database",
    sourceGroup: "کاربران",
    targetGroup: "سامانه",
    messageType: "async",
    activate: true,
    deactivate: true,
    blockType: "loop",
    blockLabel: "تا زمان موفقیت",
    note: "ثبت درخواست",
  });
  drafts.push(sequence);

  const classDiagram = createSimpleDiagramDraft("class");
  Object.assign(classDiagram.rows[0].meta, {
    relationType: "aggregation",
    sourceCardinality: "1",
    targetCardinality: "0..*",
    sourceMembers: "+title: string؛ +open()",
    targetMembers: "+id: number؛ +render()",
    sourceStereotype: "interface",
    sourceNamespace: "دامنه",
    targetNamespace: "نمایش",
  });
  drafts.push(classDiagram);

  const state = createSimpleDiagramDraft("state");
  Object.assign(state.rows[0].meta, {
    sourceParent: "چرخهٔ سند",
    targetParent: "چرخهٔ سند",
    targetKind: "choice",
    note: "نیازمند تصمیم",
  });
  drafts.push(state);

  const er = createSimpleDiagramDraft("er");
  Object.assign(er.rows[0].meta, {
    sourceCardinality: "one",
    targetCardinality: "one-many",
    identifying: false,
    sourceAttribute: "شناسهٔ سند",
    sourceAttributeType: "string",
    sourceAttributeKey: "PK",
    targetAttribute: "شناسهٔ نمودار",
    targetAttributeType: "int",
    targetAttributeKey: "FK",
  });
  drafts.push(er);

  const requirement = createSimpleDiagramDraft("requirement");
  Object.assign(requirement.rows[0].meta, {
    requirementType: "performanceRequirement",
    risk: "high",
    verificationMethod: "analysis",
    relationship: "verifies",
    elementType: "preview component",
    docref: "docs/readability.md",
  });
  drafts.push(requirement);

  const architecture = createSimpleDiagramDraft("architecture");
  Object.assign(architecture.rows[0].meta, {
    sourceIcon: "server",
    targetIcon: "database",
    sourceGroup: "سکو",
    targetGroup: "داده",
    groupParent: "محصول",
    sourcePort: "R",
    targetPort: "L",
    arrow: "both",
    align: "row",
  });
  drafts.push(architecture);

  for (const level of ["context", "container", "component", "dynamic", "deployment"]) {
    const draft = createSimpleDiagramDraft("c4");
    draft.settings.c4Level = level;
    draft.rows[0].meta.boundary = "مرز داخلی";
    draft.rows[0].meta.boundaryParent = "مرز شرکت";
    if (level === "container") draft.rows[0].meta.targetType = "ContainerDb";
    if (level === "component") {
      draft.rows[0].meta.sourceType = "Container";
      draft.rows[0].meta.targetType = "Component";
    }
    if (level === "dynamic") draft.rows[0].meta.targetType = "Container";
    if (level === "deployment") {
      draft.rows[0].meta.sourceType = "Deployment_Node";
      draft.rows[0].meta.targetType = "Container";
    }
    drafts.push(draft);
  }

  const gantt = createSimpleDiagramDraft("gantt");
  gantt.rows[1].meta.dependency = gantt.rows[0].id;
  gantt.rows[1].meta.milestone = true;
  drafts.push(gantt);

  const kanban = createSimpleDiagramDraft("kanban");
  Object.assign(kanban.rows[0].meta, { assigned: "سارا", ticket: "RA-1", priority: "High" });
  kanban.settings.ticketBaseUrl = "https://example.com/#TICKET#";
  drafts.push(kanban);

  const git = createSimpleDiagramDraft("gitgraph");
  git.rows.push({ id: "merge", first: "main", second: "ادغام", value: "ویژگی", meta: { action: "merge", commitType: "NORMAL", tag: "", parent: "" } });
  drafts.push(git);

  const pie = createSimpleDiagramDraft("pie");
  pie.settings.donutHole = "0.4";
  drafts.push(pie);

  const xy = createSimpleDiagramDraft("xychart");
  xy.rows.push(...xy.rows.map((row) => ({ ...row, id: `bar-${row.id}`, meta: { ...row.meta, series: "میله", seriesType: "bar" } })));
  xy.orientation = "vertical";
  drafts.push(xy);

  const sankey = createSimpleDiagramDraft("sankey");
  sankey.rows[0].meta.sourceColor = "#2557e5";
  drafts.push(sankey);

  const mindmap = createSimpleDiagramDraft("mindmap");
  mindmap.rows.push({ id: "deep", first: "نکتهٔ اول", second: "جزئیات", value: "", meta: { shape: "hexagon", icon: "", color: "#e9efff" } });
  drafts.push(mindmap);

  const journey = createSimpleDiagramDraft("journey");
  journey.rows[0].meta.actors = "کاربر، پشتیبان";
  drafts.push(journey);

  const quadrant = createSimpleDiagramDraft("quadrant");
  quadrant.rows[0].meta.color = "#2557e5";
  drafts.push(quadrant);

  for (const draft of drafts) {
    const prepared = prepareMermaidForRender(simpleDraftToCode(draft));
    const result = await mermaid.parse(prepared.code, { suppressErrors: false });
    assert.equal(typeof result.diagramType, "string", draft.kind);
  }
});

test("keeps safe Mermaid HTML labels while removing executable content", () => {
  const sanitized = sanitizeMermaidSvg(`
    <svg xmlns="http://www.w3.org/2000/svg">
      <foreignObject x="0" y="0" width="120" height="40">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p onclick="alert(1)">عنوان<br>امن<script>alert(1)</script></p>
          <img src="https://example.com/tracker.png" />
        </div>
      </foreignObject>
      <defs><path id="safe-shape" d="M0 0h1v1z" /></defs>
      <use href="#safe-shape" />
      <use href="https://example.com/external.svg#shape" />
    </svg>
  `);

  assert.match(sanitized, /foreignObject/u);
  assert.match(sanitized, /عنوان/u);
  assert.match(sanitized, /امن/u);
  assert.match(sanitized, /href="#safe-shape"/u);
  assert.doesNotMatch(sanitized, /script|onclick|<img|example\.com/iu);
});

test("adds an accessible Persian title and restores adapted labels", () => {
  const sanitized = sanitizeMermaidSvg(
    `<svg xmlns="http://www.w3.org/2000/svg"><text>RAAVI_FA_1</text></svg>`,
    {
      title: "نمودار جریان مطالعه",
      labelMap: new Map([["RAAVI_FA_1", "مطالعه"]]),
    },
  );

  assert.match(sanitized, /<title>نمودار جریان مطالعه<\/title>/u);
  assert.match(sanitized, /aria-label="نمودار جریان مطالعه"/u);
  assert.match(sanitized, /<text>مطالعه<\/text>/u);
  assert.match(sanitized, /Vazirmatn/u);
});

test("rejects oversized diagrams before loading the renderer", async () => {
  const result = await renderMermaid(
    "A".repeat(MERMAID_LIMITS.characters + 1),
    "light",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.kind, "limit");
});
