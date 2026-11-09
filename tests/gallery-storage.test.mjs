import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cardHeaders,equalStoredValue,lazyCardImages} from '../gallery-storage.mjs';
test('header listing retains no original images, backgrounds or text and sorts by date',async()=>{
 const records=[{id:'a',createdAt:1,charName:'A',imageBlob:new Blob(['large']),meta:{body:'private'}},{id:'b',createdAt:3,charName:'B'}];
 const db={transaction(){const tx={objectStore:()=>({getAll(){throw Error('bulk read forbidden');},openCursor(){
  const req={};let i=0;const next=()=>queueMicrotask(()=>{req.result=i<records.length?{value:records[i++],continue:next}:null;req.onsuccess();if(!req.result)queueMicrotask(()=>tx.oncomplete());});next();return req;
 }})};return tx;}};
 assert.deepEqual(await cardHeaders(db,'cards'),[{id:'b',createdAt:3,charName:'B'},{id:'a',createdAt:1,charName:'A'}]);
});
test('equal-sized different images are not considered the same backup',async()=>{
 assert.equal(await equalStoredValue(new Blob(['AAAA']),new Blob(['BBBB'])),false);
 assert.equal(await equalStoredValue({style:{background:new Blob(['same'])}}, {style:{background:new Blob(['same'])}}),true);
 assert.equal(await equalStoredValue({body:'old'}, {body:'edited'}),false);
});
test('offscreen images are not read; closing during a read cannot leak object URLs',async()=>{
 let intersect,removed,reads=0,resolve;const pending=new Promise(r=>resolve=r),created=[],revoked=[];
 const original={IntersectionObserver:globalThis.IntersectionObserver,MutationObserver:globalThis.MutationObserver,document:globalThis.document,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 try{
 globalThis.IntersectionObserver=class{constructor(cb){intersect=cb;}observe(){}unobserve(){}disconnect(){}};
 globalThis.MutationObserver=class{constructor(cb){removed=cb;}observe(){}disconnect(){}};
 globalThis.document={body:{}};URL.createObjectURL=()=>{const u='blob:'+created.length;created.push(u);return u;};URL.revokeObjectURL=u=>revoked.push(u);
 const overlay={isConnected:true},img={removeAttribute(){delete this.src;}};
 const images=lazyCardImages(async()=>{reads++;return pending;},overlay);images.add(img,'a');assert.equal(reads,0);
 intersect([{target:img,isIntersecting:true}]);assert.equal(reads,1);
 overlay.isConnected=false;removed();resolve({imageBlob:new Blob(['image'])});await new Promise(r=>setImmediate(r));
 assert.equal(created.length,0);assert.equal(img.src,undefined);
 const overlay2={isConnected:true},second=lazyCardImages(async()=>({imageBlob:new Blob(['image'])}),overlay2);
 second.add(img,'b');intersect([{target:img,isIntersecting:true}]);await new Promise(r=>setImmediate(r));assert.equal(created.length,1);
 intersect([{target:img,isIntersecting:false}]);assert.deepEqual(revoked,created);assert.equal(img.src,undefined);
 overlay2.isConnected=false;removed();
 }finally{globalThis.IntersectionObserver=original.IntersectionObserver;globalThis.MutationObserver=original.MutationObserver;globalThis.document=original.document;URL.createObjectURL=original.create;URL.revokeObjectURL=original.revoke;}
});
