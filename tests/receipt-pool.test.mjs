import test from 'node:test';
import assert from 'node:assert/strict';
import {RawGas as G,raw,address,verificationFor} from './load-core.mjs';
const asOf='2026-10-30T00:00:00.000Z';
const ok=result=>({ok:true,status:200,headers:new Headers(),json:async()=>({jsonrpc:'2.0',id:1,result})});
const status=code=>({ok:false,status:code,headers:new Headers(),json:async()=>({})});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const receiptOf=hash=>{for(let i=1;i<=40;i++)if(raw(i).hash===hash)return verificationFor(raw(i)).receipt;return null;};

test('receipt pool never exceeds its concurrency bound and keeps one receipt per POST',async()=>{
  let inFlight=0,peak=0,bodies=[];
  const client=G.createReceiptClient({concurrency:3,sleep:async()=>{},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);bodies.push(body);inFlight++;peak=Math.max(peak,inFlight);await tick();inFlight--;
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const txs=Array.from({length:12},(_,i)=>raw(i+1));
  const results=await Promise.all(txs.map(tx=>client.getReceipt(tx)));
  assert.equal(results.length,12);assert.ok(peak<=3,`peak ${peak}`);assert.ok(peak>1,'requests run in parallel');
  assert.ok(bodies.every(body=>!Array.isArray(body)&&['eth_chainId','eth_getTransactionReceipt'].includes(body.method)));
});

test('fetchWallet verifies a page with the configured concurrency and reports progress per receipt',async()=>{
  let inFlight=0,peak=0;const seen=[];
  const items=Array.from({length:20},(_,i)=>raw(i+1));
  const result=await G.fetchWallet(address,{cutoff:100,asOf,receiptConcurrency:6,request:async()=>({items,next_page_params:null}),
    getReceipt:async tx=>{inFlight++;peak=Math.max(peak,inFlight);await tick();inFlight--;return verificationFor(tx);},
    onProgress:s=>{if(s.stage==='receipts')seen.push(s.verified);}});
  assert.equal(result.rows.length,20);assert.equal(result.unresolved.length,0);
  assert.ok(peak>1&&peak<=6,`peak ${peak}`);assert.equal(seen.at(-1),20);
});

test('a rate-limited endpoint is backed off and the receipt comes from another endpoint, not unverified',async()=>{
  const calls=[];let clock=0;
  const client=G.createReceiptClient({now:()=>clock,sleep:async ms=>{clock+=ms;},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,method:body.method});
    if(url==='https://eth.drpc.org')return status(429);
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const first=await client.getReceipt(raw(1));assert.notEqual(first.source,'https://eth.drpc.org');
  const drpcBefore=calls.filter(c=>c.url==='https://eth.drpc.org').length;
  const second=await client.getReceipt(raw(2));assert.notEqual(second.source,'https://eth.drpc.org');
  assert.equal(calls.filter(c=>c.url==='https://eth.drpc.org').length,drpcBefore,'cooling endpoint is skipped while a healthy one exists');
  const drpc=client.health().find(h=>h.url==='https://eth.drpc.org');assert.ok(drpc.failures>=1&&drpc.cooldownUntil>clock-1);
});

test('when every endpoint is rate limited once, the lookup waits out the backoff and retries instead of giving up',async()=>{
  const hits=new Map();let clock=0,slept=0;
  const client=G.createReceiptClient({now:()=>clock,sleep:async ms=>{slept+=ms;clock+=ms;},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);const n=(hits.get(url)||0)+1;hits.set(url,n);
    if(n===1)return status(503);
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const verified=await client.getReceipt(raw(3));assert.equal(verified.chainId,1);assert.ok(slept>0,'backoff was honoured');
});

test('persistent transport failure ends as unverified with every endpoint named',async()=>{
  const client=G.createReceiptClient({rounds:2,sleep:async()=>{},fetch:async()=>{throw new TypeError('fetch failed');}});
  await assert.rejects(client.getReceipt(raw(1)),err=>/unverified/.test(err.message)&&/drpc/.test(err.message));
});

test('session cache: the same hash is fetched once across wallets and re-runs',async()=>{
  let receiptCalls=0;const cache=new Map();
  const make=()=>G.createReceiptClient({cache,sleep:async()=>{},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);if(body.method==='eth_getTransactionReceipt')receiptCalls++;
    return ok(body.method==='eth_chainId'?'0x1':receiptOf(body.params[0]));}});
  const a=make();await Promise.all([a.getReceipt(raw(5)),a.getReceipt(raw(5))]);
  await make().getReceipt(raw(5));
  assert.equal(receiptCalls,1);
});
