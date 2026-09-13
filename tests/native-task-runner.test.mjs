import assert from "node:assert/strict";
import test from "node:test";
import { createNativeTaskRunner } from "../desktop/native-task-runner.mjs";

const worker = new URL(`data:text/javascript,${encodeURIComponent(`
import {parentPort} from 'node:worker_threads';
parentPort.on('message',({id,task,payload})=>{
 if(task==='exit')process.exit(1);
 if(task==='block')Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,350);
 if(task==='error')parentPort.postMessage({id,error:{message:'permission',code:'EACCES'}});
 else parentPort.postMessage({id,value:payload});
});`)}`);

test("synchronous native work does not stop main-loop timers or mix concurrent replies", async () => {
  const run = createNativeTaskRunner(worker);
  let ticks = 0;
  const timer = setInterval(() => ticks++, 10);
  try {
    assert.deepEqual(await Promise.all([run("block", "first"), run("echo", "second")]), ["first", "second"]);
    assert.ok(ticks >= 10, `Main loop only progressed ${ticks} times`);
    await assert.rejects(run("error"), error => error.code === "EACCES");
    assert.equal(await run("echo", "after-error"), "after-error");
  } finally { clearInterval(timer); }
});

test("worker failure rejects pending work and the next request starts a new worker", async () => {
  const run = createNativeTaskRunner(worker);
  await assert.rejects(run("exit"), /exited/);
  assert.equal(await run("echo", "recovered"), "recovered");
  await assert.rejects(run("echo", () => {}));
  assert.equal(await run("echo", "after-clone-error"), "after-clone-error");
});
