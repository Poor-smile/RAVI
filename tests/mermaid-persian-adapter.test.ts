import assert from "node:assert/strict";
import test from "node:test";
import {
  detectMermaidKind,
  normalizePersianSearch,
  PersianMermaidInputError,
  prepareMermaidForRender,
  toAsciiDigits,
} from "../app/mermaid/persian-adapter";

test("detects every new Mermaid type supported by the installed parser", () => {
  const sources = {
    swimlane: "swimlane-beta RL",
    block: "block-beta",
    packet: "packet",
    radar: "radar-beta",
    eventmodeling: "eventmodeling",
    treemap: "treemap-beta",
    venn: "venn-beta",
    ishikawa: "ishikawa",
    wardley: "wardley-beta",
    cynefin: "cynefin-beta",
    treeview: "treeView-beta",
  } as const;
  for (const [kind, source] of Object.entries(sources)) {
    assert.equal(detectMermaidKind(source), kind);
  }
});

test("restores Persian labels stored for identifier-only diagrams", () => {
  const prepared = prepareMermaidForRender(`eventmodeling
    tf 01 ui SHOP.CART
%% raavi-label:SHOP:%D9%81%D8%B1%D9%88%D8%B4%DA%AF%D8%A7%D9%87
%% raavi-label:CART:%D8%B3%D8%A8%D8%AF`);
  assert.equal(prepared.labelMap.get("SHOP"), "فروشگاه");
  assert.equal(prepared.labelMap.get("CART"), "سبد");
});

test("normalizes Persian and Arabic digits without touching labels", () => {
  assert.equal(toAsciiDigits("۱۲٫۵ و ٣"), "12.5 و 3");
});

test("normalizes Arabic letter variants and spacing for Persian search", () => {
  assert.equal(normalizePersianSearch("  كِتاب‌ يک ۱۲ "), "کتاب یک 12");
});

test("adapts Persian Sankey labels, comma and values only for rendering", () => {
  const source = `sankey-beta

ورودی،مطالعه،۸٫۵
مطالعه,یادداشت,۳`;
  const prepared = prepareMermaidForRender(source);

  assert.equal(prepared.kind, "sankey");
  assert.match(prepared.code, /RAAVI_FA_1,RAAVI_FA_2,8\.5/u);
  assert.match(prepared.code, /RAAVI_FA_2,RAAVI_FA_3,3/u);
  assert.equal(prepared.labelMap.get("RAAVI_FA_1"), "ورودی");
  assert.equal(prepared.labelMap.get("RAAVI_FA_2"), "مطالعه");
  assert.match(source, /ورودی،مطالعه،۸٫۵/u);
});

test("reports an actionable row for malformed Sankey input", () => {
  assert.throws(
    () => prepareMermaidForRender("sankey-beta\nورودی،مطالعه"),
    (error) => {
      assert.ok(error instanceof PersianMermaidInputError);
      assert.equal(error.line, 2);
      assert.match(error.suggestion, /مبدأ، مقصد و مقدار/u);
      return true;
    },
  );
});

test("normalizes numeric slots for common data diagrams", () => {
  assert.match(
    prepareMermaidForRender('pie\n"مطالعه ۲" : ۲۵').code,
    /"مطالعه ۲" : 25/u,
  );
  assert.match(
    prepareMermaidForRender('quadrantChart\n"گزینه": [۰٫۷, ۰٫۸]').code,
    /\[0\.7, 0\.8\]/u,
  );
  assert.match(
    prepareMermaidForRender("xychart-beta\nx-axis [۱, ۲]\nline [۳, ۴]")
      .code,
    /x-axis \[1, 2\]\nline \[3, 4\]/u,
  );
});
