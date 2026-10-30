import test from 'node:test';
import assert from 'node:assert/strict';
import {RawGas as G,raw,address,verificationFor} from './load-core.mjs';
const asOf='2026-10-30T00:00:00.000Z';
const ok=result=>({ok:true,status:200,headers:new Headers(),json:async()=>({jsonrpc:'2.0',id:1,result})});
const status=code=>({ok:false,status:code,headers:new Headers(),json:async()=>({})});
const receiptOf=hash=>{for(let i=1;i<=40;i++)if(raw(i).hash===hash)return verificationFor(raw(i)).receipt;return null;};
const hang=(url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))));

function fakeTimers(){let clock=0,id=0;const timers=new Map();
  return {now:()=>clock,setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:clock+ms});return id;},clearTimeout:i=>timers.delete(i),
    advance(ms){clock+=ms;for(const [i,t] of [...timers].sort((a,b)=>a[1].at-b[1].at))if(t.at<=clock){timers.delete(i);t.fn();}},size:()=>timers.size};}

test('redraw throttle: leading call, then one trailing call per window, never more than 4/s',()=>{
  const t=fakeTimers();let calls=0;const redraw=G.createThrottle(()=>calls++,250,t);
  redraw();assert.equal(calls,1,'first update draws immediately');
  for(let i=0;i<50;i++){redraw();t.advance(10);} // 500 ms of updates every 10 ms
  assert.ok(calls>=2&&calls<=3,`calls ${calls}`);
  t.advance(250);const settled=calls;assert.equal(t.size(),0,'trailing call fired, nothing left pending');
  redraw();redraw();t.advance(1000);assert.ok(calls-settled<=2);
});

test('redraw throttle: cancel drops a pending trailing draw so the final render is not overwritten',()=>{
  const t=fakeTimers();let calls=0;const redraw=G.createThrottle(()=>calls++,250,t);
  redraw();redraw();assert.equal(redraw.pending(),true);redraw.cancel();t.advance(1000);assert.equal(calls,1);
  redraw();assert.equal(calls,2,'after cancel the next call is immediate once the window passed');
});

test('a receipt fetch that never answers is timed out and ends unverified, not hung',async()=>{
  const client=G.createReceiptClient({timeout:20,rounds:1,sleep:async()=>{},fetch:hang});
  await assert.rejects(client.getReceipt(raw(1)),/unverified after all public RPCs: .*timed out/);
});

test('an explorer/price request that never answers is timed out by createClient',async()=>{
  const client=G.createClient({timeout:20,attempts:2,sleep:async()=>{},fetch:hang});
  await assert.rejects(client.get('https://example.invalid/x'),/Retry budget exhausted/);
});

test('pool slots are freed after hung requests time out, so later receipts still verify',async()=>{
  let n=0;const client=G.createReceiptClient({concurrency:2,timeout:20,sleep:async()=>{},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);if(body.method==='eth_getTransactionReceipt'&&n++<4)return hang(url,options);
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const out=await Promise.allSettled([1,2,3,4,5,6].map(i=>client.getReceipt(raw(i))));
  assert.ok(out.filter(r=>r.status==='fulfilled').length>=2);
});

test('drpc 429 on every endpoint: receipts end unverified (never a wrong total), Resume completes once the limit lifts',async()=>{
  const items=Array.from({length:10},(_,i)=>raw(i+1));let limited=true,clock=0,cp;
  const fetch=async(url,options)=>{const body=JSON.parse(options.body);
    if(limited&&body.method==='eth_getTransactionReceipt')return status(429);
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));};
  const request=async()=>({items,next_page_params:null});
  const run=checkpoint=>{const client=G.createReceiptClient({now:()=>clock,sleep:async ms=>{clock+=ms;},fetch});
    return G.fetchWallet(address,{cutoff:100,asOf,checkpoint,request,getReceipt:client.getReceipt,onCheckpoint:c=>{cp=c;}});};
  const first=await run();
  assert.equal(first.complete,true);assert.equal(first.rows.length,0);assert.equal(first.unresolved.length,10);
  assert.equal(G.summarize(G.valueRows(first.rows,new Map())).wei,0n,'unverified fees are left out, not guessed');
  assert.ok(first.unresolved.every(tx=>/HTTP 429|rate-limited/.test(tx.reason)));
  limited=false;const second=await run(cp);
  assert.equal(second.unresolved.length,0);assert.equal(second.rows.length,10);
  const expected=items.reduce((sum,tx)=>sum+BigInt(tx.gas_used)*BigInt(tx.gas_price),0n);
  assert.equal(G.summarize(G.valueRows(second.rows,new Map())).wei,expected);
});

test('drpc 429 on some receipts only: others verify via fallbacks, nothing double counted',async()=>{
  const items=Array.from({length:10},(_,i)=>raw(i+1));let clock=0;
  const client=G.createReceiptClient({now:()=>clock,sleep:async ms=>{clock+=ms;},fetch:async(url,options)=>{const body=JSON.parse(options.body);
    if(url==='https://eth.drpc.org'&&body.method==='eth_getTransactionReceipt'&&Number(body.params[0].slice(-2))%2)return status(429);
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const r=await G.fetchWallet(address,{cutoff:100,asOf,request:async()=>({items,next_page_params:null}),getReceipt:client.getReceipt});
  assert.equal(r.rows.length+r.unresolved.length,10);assert.equal(new Set(r.rows.map(x=>x.hash)).size,r.rows.length);
});

test('circuit breaker: with every RPC rate-limited, a long backlog ends unverified quickly instead of waiting out cooldowns',async()=>{
  let clock=0,slept=0;const client=G.createReceiptClient({now:()=>clock,sleep:async ms=>{clock+=ms;slept+=ms;},
    fetch:async(url,options)=>JSON.parse(options.body).method==='eth_chainId'?ok('0x1'):status(429)});
  const out=await Promise.allSettled(Array.from({length:30},(_,i)=>client.getReceipt(raw(i+1))));
  assert.ok(out.every(r=>r.status==='rejected'));
  assert.ok(slept<5*60_000,`slept ${slept}ms of simulated cooldown`);
});

test('intermittent 429 on the only working RPC keeps throughput: success clears backoff, Retry-After is honoured as given',async()=>{
  let clock=0,slept=0,n=0;const providers=['https://eth.drpc.org','https://dead.example'];
  const client=G.createReceiptClient({providers,now:()=>clock,sleep:async ms=>{clock+=ms;slept+=ms;},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);if(url!==providers[0])throw new TypeError('fetch failed');
    if(body.method==='eth_getTransactionReceipt'&&n++%2===0)return {ok:false,status:429,headers:new Headers({'retry-after':'1'}),json:async()=>({})};
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const out=await Promise.allSettled(Array.from({length:40},(_,i)=>client.getReceipt(raw(i+1))));
  assert.ok(out.filter(r=>r.status==='fulfilled').length>=36,'most receipts verify');
  assert.ok(slept<=120_000,`simulated waiting ${slept}ms stays bounded`);
});

test('HTTP 408 from an RPC is retryable, not a permanent failure for that receipt',async()=>{
  let clock=0,n=0;const client=G.createReceiptClient({providers:['https://eth.drpc.org'],now:()=>clock,sleep:async ms=>{clock+=ms;},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);if(body.method==='eth_getTransactionReceipt'&&n++===0)return status(408);
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const v=await client.getReceipt(raw(1));assert.equal(v.source,'https://eth.drpc.org');
});

test('a receipt whose only working RPC is out never waits minutes on dead fallbacks (per-lookup wait budget)',async()=>{
  let clock=0,slept=0;const providers=['https://eth.drpc.org','https://a.example','https://b.example'];
  const client=G.createReceiptClient({providers,now:()=>clock,sleep:async ms=>{clock+=ms;slept+=ms;},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);if(url!==providers[0])throw new TypeError('fetch failed');
    return body.method==='eth_chainId'?ok('0x1'):status(404);}}); // permanent on drpc, dead elsewhere
  await assert.rejects(client.getReceipt(raw(1)),/unverified/);
  assert.ok(slept<=60_000,`waited ${slept}ms`);
});
