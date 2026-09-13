import { test, expect, type Page } from "@playwright/test";
import { installPdfBackend } from "./helpers/pdf-backend";
import { readFile } from "node:fs/promises";
import { openWritingDocument } from "./helpers/open-writing-document";

test("PDF controls follow the active theme with readable text while the actual paper stays identical", async ({page},info) => {
 const content='# گزارش چندصفحه‌ای\n\n'+Array.from({length:8},(_,i)=>`## بخش ${i+1}\n\n${'متن فارسی برای آزمون خوانایی کنترل‌های خروجی. '.repeat(60)}\n\n`).join('');
 await open(page,content); const backend=await installPdfBackend(page,info); await exportMenu(page);
 await page.locator('.export-format-choice button').filter({hasText:'PDF'}).click();
 const canvas=page.locator('.pdf-preview-canvas'); await expect(canvas).toBeVisible();
 await info.attach('prepared-pdf',{body:[...backend.files.values()][0],contentType:'application/pdf'});
 await expect.poll(()=>canvas.evaluate(node=>{
   const image=node as HTMLCanvasElement, pixels=image.getContext('2d')!.getImageData(0,0,image.width,image.height).data;
   let ink=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>0&&pixels[i]+pixels[i+1]+pixels[i+2]<600)ink++;
   return ink;
 }),{message:'The prepared page must contain visible text, not an empty canvas'}).toBeGreaterThan(1000);
 const paper=await canvas.evaluate(node=>(node as HTMLCanvasElement).toDataURL());
 const next=page.getByRole('button',{name:'صفحهٔ بعد',exact:true});
 await expect(next).toBeEnabled();
 for(const theme of ['dark','light']) {
   await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
   await expect(page.locator('.pdf-preview-settings')).toHaveCSS('background-color',theme==='dark'?'rgb(24, 30, 26)':'rgb(252, 253, 249)');
   await expect(page.locator('.pdf-preview-controls [role="status"]')).toHaveCSS('color',theme==='dark'?'rgb(242, 245, 241)':'rgb(23, 27, 24)');
   await expect(page.locator('.export-modal--preview')).toHaveCSS('color-scheme',theme);
   const save=page.getByRole('button',{name:'ذخیرهٔ PDF',exact:true});
   // Theme changes animate button colors; measure the settled surface.
   await expect(save).toHaveCSS('color',theme==='dark'?'rgb(134, 168, 255)':'rgb(37, 87, 229)');
   await expect(save).toHaveCSS('background-color',theme==='dark'?'rgb(32, 46, 80)':'rgb(233, 239, 255)');
   const contrasts=await page.locator('.pdf-preview-controls label,.pdf-preview-controls [role="status"],.pdf-preview-controls button,.pdf-preview-settings > strong,.pdf-preview-settings > span,.pdf-preview-settings > p,.pdf-preview-orientation button,.pdf-settings-footer button').evaluateAll(nodes=>{
     const rgb=(value:string)=>value.match(/[\d.]+/g)!.map(Number);
     const luminance=(color:number[])=>color.slice(0,3).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
     return nodes.map(node=>{
       const style=getComputedStyle(node);let ancestor:Element|null=node,background:number[]=[255,255,255];
       while(ancestor){const candidate=rgb(getComputedStyle(ancestor).backgroundColor);if(candidate.length===3||candidate[3]===1){background=candidate;break;}ancestor=ancestor.parentElement;}
       const foreground=luminance(rgb(style.color)),back=luminance(background);
       return {text:node.textContent?.slice(0,60),color:style.color,background:style.backgroundColor,ratio:(Math.max(foreground,back)+.05)/(Math.min(foreground,back)+.05),opacity:style.opacity};
     });
   });
   await info.attach(`pdf-contrast-${theme}`,{body:JSON.stringify(contrasts,null,2),contentType:'application/json'});
   await page.screenshot({path:info.outputPath(`pdf-controls-${theme}.png`)});
   for(const result of contrasts){expect(result.ratio,`${theme}: ${JSON.stringify(result)}`).toBeGreaterThanOrEqual(4.5);expect(result.opacity).toBe('1');}
   expect(await canvas.evaluate(node=>(node as HTMLCanvasElement).toDataURL())).toBe(paper);
   await next.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(next).toBeFocused();
   await expect(next).toHaveCSS('outline-style','solid');
   expect(await canvas.evaluate(node=>(node as HTMLCanvasElement).toDataURL())).toBe(paper);
   await page.screenshot({path:info.outputPath(`pdf-controls-${theme}.png`)});
 }
 await next.click(); await expect(page.locator('.pdf-preview-controls [role="status"]')).toContainText('صفحهٔ ۲');
 await page.getByRole('button',{name:'صفحهٔ قبل',exact:true}).click();
 await expect(page.locator('.pdf-preview-controls [role="status"]')).toContainText('صفحهٔ ۱');
});

async function open(page: Page, content = "# گزارش آزمایش\n\nاین نتیجه می‌تواند مفید باشد.\n\n- مورد اول\n- مورد دوم\n\n1. نخست\n2. دوم") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/"); await openWritingDocument(page, { content });
}
async function exportMenu(page: Page) {
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="export"]').click();
}

test("equal formats lead to exact PDF preview in both themes", async ({ page }, info) => {
  await open(page); await installPdfBackend(page,info); await exportMenu(page);
  const choices=page.locator(".export-format-choice button"); await expect(choices).toHaveCount(2);
  const styles=await choices.evaluateAll(nodes=>nodes.map(node=>{const s=getComputedStyle(node);return [s.height,s.font,s.color,s.backgroundColor];}));
  expect(styles[0]).toEqual(styles[1]); await choices.filter({hasText:"PDF"}).click();
  await expect(page.getByRole("dialog",{name:"پیش‌نمایش PDF",exact:true})).toBeVisible();
  await expect(page.locator(".pdf-preview-canvas")).toBeVisible();
  await expect(page.locator('.pdf-preview-controls [role="status"]')).toContainText("از ۱");
  await page.screenshot({path:info.outputPath("pdf-light.png")});
  await page.getByRole("button",{name:"افقی",exact:true}).click();
  await expect(page.getByRole("button",{name:"ذخیرهٔ PDF",exact:true})).toBeEnabled();
  expect(await page.locator(".pdf-preview-canvas").evaluate(node=>node.clientWidth>node.clientHeight)).toBe(true);
  await page.evaluate(()=>document.documentElement.dataset.theme="dark");
  await expect(page.locator(".pdf-preview-canvas")).toHaveCSS("background-color","rgb(255, 255, 255)");
  await page.screenshot({path:info.outputPath("pdf-dark-wide.png")});
});

test("AI retains its scope for a second edit and Undo, suppresses automatic selection prompts", async ({ page }, info) => {
  await open(page, "متن اولیه برای بازنویسی");
  await page.evaluate(() => {
    let calls = 0;
    Object.defineProperty(window, "raaviDesktop", { configurable: true, value: {
      getCodexConnectionStatus: async () => ({ state: "connected" }),
      runCodexPrompt: async ({ context }: { context: string }) => ({ answer: `مبنا: ${context}`, replacement: ++calls === 1 ? "متن دوم برای بازنویسی" : "متن سوم برای بازنویسی" }),
    } });
  });
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus(); await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "گفت‌وگو دربارهٔ متن انتخاب‌شده" }).click();
  const panel = page.locator(".ai-chat-panel");
  await expect(panel.locator(".ai-context-details")).not.toHaveAttribute("open", "");
  await expect(panel.locator(".ai-quick-prompts")).toHaveCount(0);
  await expect(panel.locator(".ai-input-placeholder kbd")).toHaveText("/");
  const input = panel.getByRole("combobox");
  for (const expected of ["متن دوم", "متن سوم"]) {
    await input.fill("بازنویسی کن"); await input.press("Enter");
    await expect(panel.locator(".ai-change-review")).toBeVisible();
    await panel.getByRole("button", { name: "جایگزینی در سند" }).click();
    await expect(editor).toContainText(expected);
    await expect(panel.locator(".ai-context-conflict")).toHaveCount(0);
  }
  await panel.getByRole("button", { name: "بازگردانی", exact: true }).click();
  await expect(editor).toContainText("متن دوم");
  await expect(panel.locator(".ai-context-conflict")).toHaveCount(0);
  await input.fill("ویرایش سوم"); await input.press("Enter");
  await panel.getByRole("button", { name: "جایگزینی در سند" }).click();
  await expect(editor).toContainText("متن سوم");
  await editor.focus(); await page.keyboard.press("Control+z");
  await expect(editor).toContainText("متن دوم");
  await expect(panel.locator(".ai-context-conflict")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("ai-continuation.png") });
});

test("AI rejects a result after an external edit and preserves the drafted message", async ({ page }) => {
  await open(page, "متن اصلی");
  await page.evaluate(() => Object.defineProperty(window, "raaviDesktop", { configurable: true, value: {
    getCodexConnectionStatus: async () => ({ state: "connected" }),
    runCodexPrompt: async () => ({ answer: "پیشنهاد", replacement: "پیشنهاد قدیمی" }),
  } }));
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus(); await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "گفت‌وگو دربارهٔ متن انتخاب‌شده" }).click();
  const panel = page.locator(".ai-chat-panel"), input = panel.getByRole("combobox");
  await input.fill("ویرایش"); await input.press("Enter");
  await expect(panel.locator(".ai-change-review")).toBeVisible();
  await editor.fill("متن جدید کاربر");
  await input.fill("پیام بعدی من");
  await expect(panel.getByRole("button", { name: "جایگزینی در سند" })).toBeDisabled();
  await panel.getByRole("button", { name: "انتخاب دوباره", exact: true }).click();
  await expect(input).toHaveValue("پیام بعدی من");
  await expect(editor).toContainText("متن جدید کاربر");
});


test("R04 targets the active table cell and R03 continues there without changing its neighbours", async ({ page }, info) => {
  await open(page, "# گزارش\n\n| شاخص | نتیجه |\n| --- | --- |\n| طول برگ | مقدار اولیه |\n| تعداد | ۲۴ |");
  await page.evaluate(() => {
    let calls = 0;
    Object.defineProperty(window, "raaviDesktop", { configurable: true, value: {
      getCodexConnectionStatus: async () => ({ state: "connected" }),
      runCodexPrompt: async () => ({ answer: "اصلاح خانه", replacement: ++calls === 1 ? "مقدار دوم" : "مقدار سوم" }),
    } });
  });
  const cell = page.locator('textarea[data-table-row="0"][data-table-column="1"]');
  await cell.focus(); await cell.press("Control+a");
  await page.getByRole("button", { name: "گفت‌وگو دربارهٔ متن انتخاب‌شده" }).click();
  const panel = page.locator(".ai-chat-panel");
  for (const value of ["مقدار دوم", "مقدار سوم"]) {
    await panel.getByRole("combobox").fill("اصلاح کن");
    await panel.getByRole("combobox").press("Enter");
    await panel.getByRole("button", { name: "جایگزینی در سند" }).click();
    await expect(cell).toHaveValue(value);
    await expect(panel.locator(".ai-context-conflict")).toHaveCount(0);
  }
  await panel.getByRole("button", { name: "بازگردانی", exact: true }).click();
  await expect(cell).toHaveValue("مقدار دوم");
  await expect(page.locator('textarea[data-table-row="1"][data-table-column="1"]')).toHaveValue("۲۴");
  await expect(panel.locator(".ai-context-conflict")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("ai-table.png") });
});

test("R11 adds to the selected series, exposes counts, transfers a point and undoes it", async ({ page }, info) => {
  await open(page);
  await page.locator("#markdown-editor .cm-content").focus(); await page.keyboard.press("Alt+KeyM");
  const studio = page.getByRole("dialog", { name: "استودیو گراف", exact: true });
  await expect(studio).toBeVisible();
  await studio.locator('.mermaid-ai-catalog > button').filter({ hasText: /XY/ }).click();
  const simple = studio.getByRole("button", { name: "ساخت آسان", exact: true });
  if (await simple.isVisible()) await simple.click();
  const add = studio.getByRole("button", { name: "افزودن نقطه به رشد", exact: true });
  await add.click();
  const rows = studio.locator('.mermaid-form-table.is-xychart .mermaid-form-row-shell');
  await expect(rows).toHaveCount(4);
  await rows.last().locator('.mermaid-form-row input').nth(0).fill("روز ۴");
  await rows.last().locator('.mermaid-form-row input').nth(1).fill("۱۴٫۲");
  await studio.getByRole("button", { name: "افزودن سری", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await rows.last().locator('.mermaid-form-row input').nth(0).fill("روز ۵");
  await rows.last().locator('.mermaid-form-row input').nth(1).fill("۱۵");
  await expect(studio.locator('.mermaid-form-issues')).toContainText("رشد");
  await rows.last().getByRole("combobox", { name: "انتقال نقطه روز ۵ به سری" }).selectOption("رشد");
  await expect(studio.locator('.mermaid-form-issues')).toHaveCount(0);
  await expect(studio.getByRole("button", { name: "افزودن به سند", exact: true })).toBeEnabled({ timeout: 20000 });
  await studio.locator(".xy-series-controls").scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("xy-corrected.png") });
  await studio.getByRole("button", { name: "برگرداندن تغییر فرم", exact: true }).click();
  await expect(studio.locator(".mermaid-form-issues")).toBeVisible();
});


test("R12 outline navigates both editing panes to the late heading", async ({ page }, info) => {
  const content = Array.from({ length: 35 }, (_, i) => `## فصل ${i+1}\n\n${"بند بلند برای آزمون پیمایش. ".repeat(90)}\n\n`).join("");
  await open(page, content);
  await page.getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true }).click();
  await page.locator('[data-sidebar-destination="outline"]:visible').click();
  for (const chapter of [35, 1, 20]) {
    await page.locator('.sidebar-row').filter({ has: page.locator('.sidebar-row-label', { hasText: new RegExp(`^فصل ${chapter}$`) }) }).click();
    for (const id of ["#writing-editor", "#markdown-editor"]) {
      await expect(page.locator(`${id} .cm-line`).filter({ hasText: new RegExp(`فصل ${chapter}$`) })).toBeInViewport();
    }
    // Verify the destination survives delayed CodeMirror measurements and the
    // subsequent scroll-sync events, rather than observing one transient frame.
    await page.waitForTimeout(1200);
    await expect(page.locator('#writing-editor .cm-line').filter({ hasText: new RegExp(`فصل ${chapter}$`) })).toBeInViewport();
  }
  await page.screenshot({ path: info.outputPath("split-outline.png") });
});

test("D01 editor paper differs from the workspace in light and dark themes", async ({ page }, info) => {
  await open(page);
  for (const theme of ["light", "dark"]) {
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const colors = await page.locator('.workspace[data-workspace-screen="writing"]').evaluate(node => ({
      workspace: getComputedStyle(node).backgroundColor,
      paper: getComputedStyle(node.querySelector('.editor-pane')!).backgroundColor,
      scrollSurface: getComputedStyle(node.querySelector('.editor-pane .cm-scroller')!).backgroundColor,
    }));
    expect(colors.workspace).not.toBe(colors.paper);
    expect(colors.paper).toBe(theme === "light" ? "rgb(255, 255, 255)" : "rgb(38, 56, 45)");
    expect(colors.scrollSurface).toBe('rgba(0, 0, 0, 0)');
    await page.screenshot({ path: info.outputPath(`editor-${theme}.png`) });
  }
});

test("R09 Ctrl+S opens document save while the AI prompt keeps focus", async ({ page }) => {
  await open(page, "متن ذخیره نشده");
  await page.evaluate(() => Object.defineProperty(window, "raaviDesktop", { configurable: true, value: {
    getCodexConnectionStatus: async () => ({ state: "connected" }),
  } }));
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus(); await page.keyboard.press("Control+a");
  await page.getByRole("button", { name: "گفت‌وگو دربارهٔ متن انتخاب‌شده" }).click();
  const input = page.locator(".ai-chat-panel").getByRole("combobox");
  await input.fill("پیش‌نویس پیام"); await input.press("Control+s");
  await expect(page.getByRole("dialog", { name: "ذخیره فایل", exact: true })).toBeVisible();
  await expect(input).toHaveValue("پیش‌نویس پیام");
});

test("R08 a comment reveals its late target in the editor", async ({ page }) => {
  const quote = "محل نظر در انتهای سند";
  const content = "# آغاز\n\n" + "بند طولانی برای پیمایش.\n\n".repeat(120) + quote;
  await page.addInitScript(({ content, quote }) => {
    localStorage.clear();
    localStorage.setItem("raavi:document:v1", JSON.stringify({ fileName: "نظر", content, readerSize: 18,
      annotations: [{ id: "late-comment", kind: "comment", start: content.indexOf(quote), end: content.length,
        quote, prefix: "", suffix: "", body: "این جمله بازبینی شود", createdAt: new Date().toISOString() }],
      assets: [], revision: 1, versions: [], activeDocumentPath: "", documentType: "ravi", lastSavedSnapshot: "",
      draftId: "comment-jump-test", viewMode: "desk", readingPositions: {}, annotationComposer: null }));
  }, { content, quote });
  await page.goto("/");
  await expect(page.locator("#markdown-editor .cm-content")).toBeVisible();
  await page.locator('[data-sidebar-destination="comments"]:visible').click();
  await page.getByRole('button', { name: new RegExp(quote) }).first().click();
  await expect(page.locator('#markdown-editor .cm-line').filter({ hasText: quote })).toBeInViewport();
});

test("R06 saves the exact prepared landscape PDF without regenerating", async ({ page }, info) => {
  await open(page,"# گزارش نهایی\n\n- مورد اول\n- مورد دوم\n\n| شاخص | نتیجه |\n| --- | --- |\n| طول برگ | ۱۲ |");
  const backend=await installPdfBackend(page,info); await exportMenu(page);
  await page.locator('.export-format-choice button').filter({hasText:"PDF"}).click();
  await expect(page.locator('.pdf-preview-canvas')).toBeVisible();
  await page.getByRole('button',{name:'افقی',exact:true}).click();
  await expect(page.getByRole('button',{name:'ذخیرهٔ PDF',exact:true})).toBeEnabled();
  const count=await page.evaluate(()=>(window as unknown as {pdfTest:{calls:number}}).pdfTest.calls);
  await page.evaluate(()=>document.documentElement.dataset.theme='dark');
  await page.getByRole('button',{name:'ذخیرهٔ PDF',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'خروجی آماده است',exact:true})).toBeVisible();
  expect(backend.saved).toHaveLength(1);
  expect(await readFile(info.outputPath('saved.pdf'))).toEqual(backend.files.get(backend.saved[0]));
  expect(await page.evaluate(()=>(window as unknown as {pdfTest:{calls:number}}).pdfTest.calls)).toBe(count);
  await expect(page.locator('#raavi-print-root')).toHaveCount(0);
});

test("R01 all twelve diagrams and six equations in the original long fixture reach PDF", async ({page},info)=>{
 test.setTimeout(120000);
 const content=await readFile("tests/fixtures/corrective-large-current.md","utf8");
 await open(page,content); const backend = await installPdfBackend(page,info); await exportMenu(page);
 await page.locator('.export-format-choice button').filter({hasText:"PDF"}).click();
 await expect(page.locator('.pdf-preview-canvas')).toBeVisible({timeout:90000});
 expect(backend.captures.at(-1)).toEqual({diagrams:12,equations:6});
 await expect(page.getByRole('button',{name:'صفحهٔ بعد',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'صفحهٔ بعد',exact:true}).click();
 await expect(page.locator('.pdf-preview-controls [role="status"]')).toContainText('صفحهٔ ۲');
 await page.screenshot({path:info.outputPath('long-pdf-preview.png')});
 await page.getByRole('button',{name:'ذخیرهٔ PDF',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'خروجی آماده است',exact:true})).toBeVisible();
});

test("R02 an unsupported Word equation requires warning review and offers PDF", async ({ page }) => {
  await open(page, "$$\n\\widehat{x+y}\n$$");
  await exportMenu(page);
  await page.locator('.export-format-choice button').filter({ hasText: "Word" }).click();
  const review = page.getByRole('dialog', { name: 'بازبینی خروجی', exact: true });
  await expect(review).toBeVisible();
  await expect(review.locator('.export-review')).toContainText('فرمول');
  await expect(review.getByRole('button', { name: 'ادامه و ذخیره', exact: true })).toBeDisabled();
  await review.getByRole('button', { name: 'پیش‌نمایش PDF', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'پیش‌نمایش PDF', exact: true })).toBeVisible();
  await expect(page.locator('.pdf-browser-note')).toBeVisible();
});

test("PDF generation failure retries; rapid orientation and closing cannot keep stale output", async ({page},info)=>{
 await open(page); const backend=await installPdfBackend(page,info);
 await page.evaluate(()=>{(window as unknown as {pdfTest:{failNext:boolean}}).pdfTest.failNext=true;});
 await exportMenu(page); await page.locator('.export-format-choice button').filter({hasText:'PDF'}).click();
 await expect(page.locator('.pdf-preview-error')).toBeVisible();
 await expect(page.getByRole('button',{name:'ذخیرهٔ PDF',exact:true})).toBeDisabled();
 await page.locator('.pdf-preview-error').getByRole('button',{name:'تلاش دوباره',exact:true}).click();
 await expect(page.locator('.pdf-preview-canvas')).toBeVisible();
 await page.evaluate(()=>{(window as unknown as {pdfTest:{delay:number}}).pdfTest.delay=800;});
 await page.getByRole('button',{name:'افقی',exact:true}).click();
 await page.getByRole('button',{name:'عمودی',exact:true}).click();
 await expect(page.getByRole('button',{name:'ذخیرهٔ PDF',exact:true})).toBeEnabled();
 expect(await page.locator('.pdf-preview-canvas').evaluate(node=>node.clientHeight>node.clientWidth)).toBe(true);
 await page.getByRole('button',{name:'افقی',exact:true}).click();
 await page.getByRole('button',{name:'بازگشت به سند',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'پیش‌نمایش PDF',exact:true})).toHaveCount(0);
 await expect.poll(()=>backend.files.size).toBe(0);
 await expect(page.locator('#raavi-print-root')).toHaveCount(0);
});

test("web uses the browser print preview and never claims a file was saved", async ({page})=>{
 await open(page);
 await page.evaluate(()=>{
   window.print=()=>{sessionStorage.setItem('print-test',document.querySelector('#raavi-print-root')?.textContent||'');};
 });
 await exportMenu(page); await page.locator('.export-format-choice button').filter({hasText:'PDF'}).click();
 await expect(page.locator('.pdf-browser-note')).toBeVisible();
 await expect(page.locator('.pdf-preview-canvas')).toHaveCount(0);
 await page.getByRole('button',{name:'پیش‌نمایش و ذخیره در مرورگر',exact:true}).click();
 expect(await page.evaluate(()=>sessionStorage.getItem('print-test'))).toContain('گزارش آزمایش');
 await expect(page.getByRole('dialog',{name:'خروجی آماده است',exact:true})).toHaveCount(0);
 await expect(page.locator('#raavi-print-root')).toHaveCount(0);
});
