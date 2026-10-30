import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
test('local static server retries an occupied preferred port without stopping its listener',async()=>{
  assert.ok(existsSync('scripts/serve.mjs'),'static server script must exist');
  const blocker=createServer((req,res)=>res.end('existing listener'));
  blocker.listen(0,'127.0.0.1');await once(blocker,'listening');
  const port=blocker.address().port;
  const child=spawn(process.execPath,['scripts/serve.mjs','--port',String(port),'--plain'],{stdio:['ignore','pipe','pipe']});
  try {
    let output='';
    const url=await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('server did not print selected URL')),5000);
      child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timeout);resolve(match[0]);}});
      child.once('exit',code=>{clearTimeout(timeout);reject(Error(`server exited ${code}`));});
    });
    assert.notEqual(new URL(url).port,String(port));
    const response=await fetch(url);assert.equal(response.status,200);assert.match(await response.text(),/<title>Wallet gas/);
    assert.equal(await (await fetch(`http://127.0.0.1:${port}`)).text(),'existing listener');
    assert.equal((await fetch(url+'/NIGHT_NOTE.md')).status,404);
  } finally {child.kill('SIGTERM');blocker.close();}
});
