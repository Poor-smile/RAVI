import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedPdfStore } from '../desktop/prepared-pdf-store.mjs';
test('prepared PDF keeps immutable native bytes and enforces owner identity', () => {
 const store=createPreparedPdfStore(); const source=Buffer.from('%PDF-1.7\ncontent');
 const result=store.add(1,source); source.fill(0); result.bytes.fill(0);
 assert.equal(store.read(1,result.id).toString(),'%PDF-1.7\ncontent');
 assert.throws(()=>store.read(2,result.id),/EXPIRED/); store.release(2,result.id);
 assert.equal(store.read(1,result.id).length,16); store.release(1,result.id);
 assert.throws(()=>store.read(1,result.id),/EXPIRED/);
});
test('prepared PDFs are bounded and released on window close',()=>{
 const store=createPreparedPdfStore(30); const a=store.add(1,Buffer.from('%PDF-a'));
 store.add(1,Buffer.from('%PDF-b')); const c=store.add(1,Buffer.from('%PDF-c'));
 assert.throws(()=>store.read(1,a.id)); store.clear(1); assert.throws(()=>store.read(1,c.id));
 assert.throws(()=>store.add(1,Buffer.from('not pdf'))); assert.throws(()=>store.add(1,Buffer.from('%PDF-'+ 'x'.repeat(30))));
});
