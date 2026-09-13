import { releaseElectron as electron } from './helpers/release-electron';
import { waitForRaaviWindow } from './helpers/electron-main-window';
import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

test('native PDF preview and saved bytes agree for short, wide and long documents in both orientations', async ({}, info)=>{
 test.setTimeout(240000);
 const profile=await mkdtemp(path.join(os.tmpdir(),'raavi-pdf-exact-'));
 const app=await electron.launch({args:[path.resolve('desktop/main.mjs'),`--user-data-dir=${profile}`]});
 try {
   const page=await waitForRaaviWindow(app); await page.emulateMedia({reducedMotion:'reduce'});
   await app.evaluate(({ipcMain})=>{
     const handlers=(ipcMain as unknown as {_invokeHandlers:Map<string,(...args:unknown[])=>Promise<{id:string;bytes:Uint8Array}>>})._invokeHandlers;
     const original=handlers.get('export:prepare-pdf')!;
     const state=globalThis as typeof globalThis & {pdfCaptures:{id:string;bytes:number[]}[]}; state.pdfCaptures=[];
     ipcMain.removeHandler('export:prepare-pdf');
     ipcMain.handle('export:prepare-pdf',async(...args)=>{const result=await original(...args);state.pdfCaptures.push({id:result.id,bytes:[...result.bytes]});return result;});
   });
   const documents=[
     ['short','# گزارش نهایی\n\n- مورد اول\n- مورد دوم\n\n$$\n\\frac{x+1}{n-1}\n$$'],
     ['wide','# جدول عریض\n\n| شاخص | روز ۱ | روز ۲ | روز ۳ | روز ۴ | روز ۵ | روز ۶ | روز ۷ |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n| طول برگ | ۱۲٫۴ | ۱۳٫۱ | ۱۳٫۸ | ۱۴٫۲ | ۱۴٫۸ | ۱۵٫۱ | ۱۵٫۴ |'],
     ['long',await readFile('tests/fixtures/corrective-large-current.md','utf8')],
   ];
   for(const [name,content] of documents){
     const source=path.join(profile,`${name}.md`); await writeFile(source,content);
     await app.evaluate(({dialog},source)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[source]});},source);
     const desk=page.getByRole('button',{name:'بازگشت به میز',exact:true}); if(await desk.isVisible())await desk.click();
     await page.getByRole('button',{name:'باز کردن فایل',exact:true}).click();
     await expect(page.locator('.document-identity')).toContainText(`${name}.md`);
     if(await desk.isVisible())await desk.click();
     for(const landscape of [false,true]){
       await page.evaluate(theme=>document.documentElement.dataset.theme=theme,landscape?'dark':'light');
       await page.locator('.header-overflow-trigger').click(); await page.locator('[data-overflow-action="export"]').click();
       await page.locator('.export-format-choice button').filter({hasText:'PDF'}).click();
       await expect(page.locator('.pdf-preview-canvas')).toBeVisible({timeout:90000});
       await page.getByRole('button',{name:landscape?'افقی':'عمودی',exact:true}).click();
       const consent=page.getByRole('checkbox',{name:'با این تغییرها موافقم'});
       if(await consent.isVisible())await consent.check();
       const save=page.getByRole('button',{name:'ذخیرهٔ PDF',exact:true});
       try { await expect(save).toBeEnabled({timeout:60000}); } catch(error) {
         await page.screenshot({path:info.outputPath('failed-preview.png')});
         await writeFile(info.outputPath('failed-preview.txt'),await page.locator('.export-modal').textContent()??'');
         throw error;
       }
       const capture=await app.evaluate(()=> (globalThis as typeof globalThis & {pdfCaptures:{id:string;bytes:number[]}[]}).pdfCaptures.at(-1)!);
       const count=await app.evaluate(()=> (globalThis as typeof globalThis & {pdfCaptures:unknown[]}).pdfCaptures.length);
       const file=info.outputPath(`${name}-${landscape?'landscape':'portrait'}.pdf`);
       if(name==='short'&&!landscape){
         await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true,filePath:''});});
         await save.click(); await expect(save).toBeEnabled();
         await expect(page.locator('.pdf-preview-canvas')).toBeVisible();
         expect(await app.evaluate(()=> (globalThis as typeof globalThis & {pdfCaptures:unknown[]}).pdfCaptures.length)).toBe(count);
       }
       await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},file);
       await page.screenshot({path:info.outputPath(`${name}-${landscape?'dark':'light'}.png`)});
       await save.click(); await expect(page.getByRole('dialog',{name:'خروجی آماده است',exact:true})).toBeVisible();
       expect(await readFile(file)).toEqual(Buffer.from(capture.bytes));
       expect(await app.evaluate(()=> (globalThis as typeof globalThis & {pdfCaptures:unknown[]}).pdfCaptures.length)).toBe(count);
       await page.getByRole('button',{name:'تمام',exact:true}).click();
     }
     expect(await readFile(source,'utf8')).toBe(content);
   }
 } finally {
   await app.close();
   if(path.dirname(path.resolve(profile))!==path.resolve(os.tmpdir())||!path.basename(profile).startsWith('raavi-pdf-exact-'))throw new Error('Unsafe test cleanup');
   await rm(profile,{recursive:true,force:true});
 }
});
