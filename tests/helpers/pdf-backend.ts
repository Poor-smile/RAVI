import { expect, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
export async function installPdfBackend(page: Page, info: TestInfo) {
 const captures: { diagrams: number; equations: number }[] = [];
 const files = new Map<string, Buffer>(); let sequence = 0; const saved: string[] = [];
 await page.exposeFunction("prepareTestPdf", async () => {
   await expect(page.locator('#raavi-print-root')).toBeAttached();
   await expect(page.locator('#raavi-print-root button')).toHaveCount(0);
   captures.push(await page.locator("#raavi-print-root").evaluate(node=>({diagrams:node.querySelectorAll(".mermaid-diagram img.mermaid-render-surface").length,equations:node.querySelectorAll(".formula-document-block .katex").length})));
   const bytes = await page.pdf({ printBackground: true, preferCSSPageSize: true });
   const id = `pdf-${++sequence}`; files.set(id, bytes);
   return { id, bytes: [...bytes] };
 });
 await page.exposeFunction("saveTestPdf", async (id: string) => {
   const bytes=files.get(id); if(!bytes) throw new Error("Expired PDF");
   const path=info.outputPath("saved.pdf"); await writeFile(path,bytes); saved.push(id);
   return { saved:true,filePath:path };
 });
 await page.exposeFunction("releaseTestPdf", (id: string)=>files.delete(id));
 await page.evaluate(() => {
   const bridge=window as unknown as {
     prepareTestPdf:()=>Promise<{id:string;bytes:number[]}>;
     saveTestPdf:(id:string)=>Promise<{saved:boolean;filePath:string}>;
     releaseTestPdf:(id:string)=>Promise<void>;
     pdfTest:{failNext:boolean;delay:number;calls:number};
   };
   bridge.pdfTest={failNext:false,delay:0,calls:0};
   Object.defineProperty(window,"raaviDesktop",{configurable:true,value:{
     preparePdf:async()=>{
       bridge.pdfTest.calls++;
       if(bridge.pdfTest.failNext){bridge.pdfTest.failNext=false;throw new Error("Injected generation failure");}
       const result=await bridge.prepareTestPdf();
       if(bridge.pdfTest.delay) await new Promise(resolve=>setTimeout(resolve,bridge.pdfTest.delay));
       return result;
     },
     savePreparedPdf:(id:string)=>bridge.saveTestPdf(id),
     releasePreparedPdf:(id:string)=>bridge.releaseTestPdf(id),
   }});
 });
 return {files,saved,captures};
}
