import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {openWritingDocument} from './helpers/open-writing-document';
import {installPdfBackend} from './helpers/pdf-backend';
async function open(page:Page,info:TestInfo,content:string){
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await openWritingDocument(page,{content,fileName:'گزارش آزمایشگاه'});
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,info.project.name.startsWith('dark')?'dark':'light');
}
async function shot(page:Page,info:TestInfo,name:string){
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:info.outputPath(`${name}.png`)});
 const metrics=await page.locator('.ai-chat-panel,.ai-context-details summary,.ai-context-summary strong,.ai-context-summary small,.ai-input-placeholder kbd,.ai-change-review,.ai-context-conflict,.xy-series-controls,.export-modal,.export-format-choice button,.pdf-preview-canvas,.pdf-preview-controls,.pdf-settings-footer .button,.editor-pane .cm-editor').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{selector:node.className,tag:node.tagName,text:node.textContent?.slice(0,80),x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,color:s.color,background:s.backgroundColor,border:s.borderRadius,overflow:s.overflow};}));
 await writeFile(info.outputPath(`${name}.json`),JSON.stringify(metrics,null,2));
}
async function ai(page:Page){
 await page.evaluate(()=>Object.defineProperty(window,'raaviDesktop',{configurable:true,value:{getCodexConnectionStatus:async()=>({state:'connected'}),runCodexPrompt:async()=>({answer:'پیشنهاد راوی',replacement:'میانگین طول برگ‌ها: ۱۲٫۴ سانتی‌متر.'})}}));
}
test('AI selected text, compact/open context, review, applied, undo and conflict',async({page},info)=>{
 await open(page,info,'میانگین طول برگ‌ها ۱۲٫۴ سانتی‌متر است.');await ai(page);
 const editor=page.locator('#markdown-editor .cm-content');await editor.focus();await page.keyboard.press('Control+a');
 await page.getByRole('button',{name:'گفت‌وگو دربارهٔ متن انتخاب‌شده'}).click();
 const panel=page.locator('.ai-chat-panel'),input=panel.getByRole('combobox');
 await expect(panel.locator('.ai-input-placeholder kbd')).toBeVisible();await expect(panel.locator('.ai-quick-prompts')).toHaveCount(0);
 await expect(panel.locator('.ai-composer-hint')).toHaveCount(0);
 await expect(panel.locator('.ai-input-placeholder kbd')).toHaveCSS('width','20px');
 await expect(panel.locator('.ai-context-summary strong')).toHaveCSS('font-size','12px');
 await shot(page,info,'ai-selected-collapsed');
 const summary=panel.locator('.ai-context-details summary');await summary.focus();await page.keyboard.press('Enter');
 await expect(panel.locator('.ai-context-details')).toHaveAttribute('open','');await shot(page,info,'ai-context-open');
 await input.fill('کوتاه‌تر کن؛ عدد و واحد را حفظ کن.');await input.press('Enter');await expect(panel.locator('.ai-change-review')).toBeVisible();await shot(page,info,'ai-review');
 await panel.getByRole('button',{name:'جایگزینی در سند'}).click();await expect(editor).toContainText('برگ‌ها:');await shot(page,info,'ai-applied');
 await panel.getByRole('button',{name:'بازگردانی',exact:true}).click();await expect(editor).toContainText('است.');await shot(page,info,'ai-undo');
 await input.fill('اصلاح کن');await input.press('Enter');await expect(panel.locator('.ai-change-review')).toBeVisible();
 await editor.fill('متن تازهٔ کاربر');await input.fill('پیش‌نویس من');await expect(panel.locator('.ai-context-conflict')).toBeVisible();await shot(page,info,'ai-conflict');
 await panel.getByRole('button',{name:'انتخاب دوباره',exact:true}).click();await expect(input).toHaveValue('پیش‌نویس من');await shot(page,info,'ai-reselected');
});
test('AI table cell target',async({page},info)=>{
 await open(page,info,'# گزارش آزمایشگاه\n\n| شاخص | نتیجه |\n| --- | --- |\n| طول برگ | میانگین طول برگ‌ها ۱۲٫۴ سانتی‌متر است. |');await ai(page);
 const cell=page.locator('textarea[data-table-row="0"][data-table-column="1"]');await cell.focus();await cell.press('Control+a');await page.getByRole('button',{name:'گفت‌وگو دربارهٔ متن انتخاب‌شده'}).click();
 const panel=page.locator('.ai-chat-panel');await expect(panel.locator('.ai-quick-prompts')).toHaveCount(0);await shot(page,info,'ai-table');
});
test('XY valid series and mismatched series error',async({page},info)=>{
 if(info.project.name.endsWith('laptop'))await page.setViewportSize({width:1366,height:768});
 await open(page,info,'# گزارش آزمایشگاه');await page.locator('#markdown-editor .cm-content').focus();await page.keyboard.press('Alt+KeyM');
 const studio=page.getByRole('dialog',{name:'استودیو گراف',exact:true});await expect(studio).toBeVisible();await studio.locator('.mermaid-ai-catalog > button').filter({hasText:/XY/}).click();
 const simple=studio.getByRole('button',{name:'ساخت آسان',exact:true});if(await simple.isVisible())await simple.click();
 await expect(studio.getByRole('button',{name:'افزودن سری',exact:true})).toBeVisible();
 await expect(studio.getByRole('button',{name:'افزودن به سند',exact:true})).toBeEnabled({timeout:30000});
 await studio.locator('.xy-series-controls').scrollIntoViewIfNeeded();await shot(page,info,'xy-valid');
 await studio.getByRole('button',{name:'افزودن سری',exact:true}).click();
 const point=studio.locator('.mermaid-form-table.is-xychart .mermaid-form-row-shell').last();
 await point.locator('.mermaid-form-row input').nth(0).fill('روز ۴');await point.locator('.mermaid-form-row input').nth(1).fill('۱۴٫۲');
 await expect(studio.locator('.mermaid-form-issues').first()).toBeVisible();
 await studio.locator('.xy-series-controls').scrollIntoViewIfNeeded();await shot(page,info,'xy-error');
});
test('editor contrast, format choice, Word warning and exact PDF',async({page},info)=>{
 await open(page,info,'# گزارش آزمایشگاه\n\nمتن فارسی برای بررسی صفحهٔ ویرایش.\n\n$$\n\\widehat{x+y}\n$$');await installPdfBackend(page,info);await shot(page,info,'editor');
 await page.locator('.header-overflow-trigger').click();await page.locator('[data-overflow-action="export"]').click();await page.locator('.export-format-choice button').first().focus();
 await expect(page.locator('.export-format-choice button').first()).toHaveCSS('font-size','12px');await shot(page,info,'format');
 await page.locator('.export-format-choice button').filter({hasText:'Word'}).click();await expect(page.locator('.export-review')).toBeVisible();await shot(page,info,'word-warning');
 await page.getByRole('button',{name:'پیش‌نمایش PDF',exact:true}).click();await expect(page.locator('.pdf-preview-canvas')).toBeVisible();await shot(page,info,'pdf');
 await page.getByRole('button',{name:'افقی',exact:true}).click();await expect(page.locator('.pdf-preview-canvas')).toBeVisible();await shot(page,info,'pdf-landscape');
});
test('Word warning reveals its formula and keeps the source intact',async({page},info)=>{
 const content='# گزارش\n\n'+('بند برای پیمایش.\n\n'.repeat(50))+'$$\n\\widehat{x+y}\n$$';
 await open(page,info,content);await page.locator('.header-overflow-trigger').click();await page.locator('[data-overflow-action="export"]').click();
 await page.locator('.export-format-choice button').filter({hasText:'Word'}).click();await page.getByRole('button',{name:'دیدن در سند',exact:true}).click();
 await expect(page.locator('.export-modal')).toHaveCount(0);await expect(page.locator('#markdown-editor .cm-rich-formula')).toBeInViewport();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('raavi:document:v1')||'{}').content)).toBe(content);
 await shot(page,info,'word-source-revealed');
});
