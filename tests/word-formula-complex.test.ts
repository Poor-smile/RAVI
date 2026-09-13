import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { createWordExport } from '../app/export/word';
import { FORMULA_ACADEMIC_CORPUS } from './fixtures/formula-academic-corpus';

async function exportFormula(latex:string){
 const result=await createWordExport({markdown:`قبل\n\n$$\n${latex}\n$$\n\nبعد\n\n| شاخص | مقدار |\n| --- | --- |\n| آزمون | ۱۲ |`,fileName:'formula.docx',imageAssets:[]});
 const zip=await JSZip.loadAsync(result.bytes);
 return {result,xml:await zip.file('word/document.xml')!.async('string')};
}
for(const sample of FORMULA_ACADEMIC_CORPUS){
 test(`REM02 ${sample.id}: native editable equation with surrounding Persian/table`,async()=>{
   const {result,xml}=await exportFormula(sample.latex);
   assert.deepEqual(result.warnings,[],sample.latex);
   assert.equal((xml.match(/<m:oMath>/g)||[]).length,1);
   assert.match(xml,/<w:tbl>/); assert.match(xml,/قبل/); assert.match(xml,/بعد/);
   assert.doesNotMatch(xml,/\$\$|w:drawing/);
 });
}
test('REM02 preserves matrix rows, cells and nested mathematical structures',async()=>{
 const {xml}=await exportFormula('\\begin{pmatrix}a & \\frac{b}{c}\\\\\\sqrt{d} & e^2\\end{pmatrix}');
 assert.equal((xml.match(/<m:mr>/g)||[]).length,2);
 assert.match(xml,/<m:f>/); assert.match(xml,/<m:rad>/); assert.match(xml,/<m:sSup>/);
 assert.match(xml,/<m:begChr m:val="\("/);
});
test('REM02 keeps integrand outside braces and differential, and function argument commas',async()=>{
 const {xml}=await exportFormula('\\int_{0}^{1} x^2\\,\\mathrm{d}{x}');
 assert.match(xml,/<m:nary>/); assert.match(xml,/<m:sSup>/); assert.match(xml,/>2<\/m:t>/);
 assert.match(xml,/> d<\/m:t>/);
 const fn=await exportFormula('\\max\\left(a,b,c\\right)');
 assert.equal((fn.xml.match(/>,<\/m:t>/g)||[]).length,2);
});
test('REM02 does not silently equalize different orders in a fraction',async()=>{
 const {xml}=await exportFormula('\\frac{\\mathrm{d}^{2}{f}}{\\mathrm{d}{x}^{3}}');
 assert.match(xml,/>2<\/m:t>/); assert.match(xml,/>3<\/m:t>/);
});

test('REM02 warns for a superscripted limit instead of silently discarding its bound',async()=>{
 const latex='\\lim_{x\\to 0}^{2}{x}';
 const {result,xml}=await exportFormula(latex);
 assert.equal(result.warnings.length,1);
 assert.doesNotMatch(xml,/<m:oMath>/);
 assert.ok(xml.includes(latex));
});
test('REM04 unsupported warning points to the original source after YAML frontmatter',async()=>{
 const markdown='---\ntitle: آزمایش\n---\n\nقبل\n\n$$\n\\widehat{x}\n$$';
 const result=await createWordExport({markdown,fileName:'warning.docx',imageAssets:[]});
 const warning=result.warnings.find(w=>w.sourceRange)!;
 assert.equal(warning.sourceRange?.start,markdown.indexOf('$$'));
 assert.equal(markdown.slice(warning.sourceRange!.start,warning.sourceRange!.end).trim(),'$$\n\\widehat{x}\n$$');
 assert.match(warning.message,/خط ۷/);
});
