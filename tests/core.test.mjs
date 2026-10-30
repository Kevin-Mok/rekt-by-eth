import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Gas, raw, address, verificationFor } from './load-core.mjs';
const fn = name => { assert.equal(typeof Gas[name], 'function', `${name} must be implemented in the inline production core`); return Gas[name]; };
const fixture = JSON.parse(readFileSync('fixtures/sources/restart-small-wallet.json'));
const wallet = fixture.response.items[0].from;

test('arbitrary full hex addresses deduplicate across case and delimiters; explicit no-checksum policy', () => {
  const parse = fn('parseAddresses');
  assert.deepEqual([...parse(`${address}, ${address.toUpperCase().replace('0X','0x')};\n0x${'cd'.repeat(20)}`)], [address, '0x'+'cd'.repeat(20)]);
  for (const input of ['', 'vitalik.eth', '0x123', `${address},bad`, '<img>']) assert.throws(() => parse(input), /address/i);
});
test('receipt multiplication exceeds Number precision; failed fee remains a subset', () => {
  const normalize = fn('normalizeTransaction');
  const row = normalize(raw(1, { status: 'error' }), address);
  assert.equal(row.feeWei, 2592592569259245000n);
  assert.equal(row.failed, true);
  assert.equal(fn('formatEth')(row.feeWei), '2.592592569259245');
  assert.equal(Gas.formatEth(1n), '0.000000000000000001');
  assert.equal(Gas.formatEth(0n), '0');
});
test('reject missing gas/effective price/status and ignore incoming rows', () => {
  const normalize = fn('normalizeTransaction');
  for (const extra of [{ gas_used: null }, { gas_price: '' }, { status: null }, { status: 'pending' }, { gas_price: '1.3' }, { gas_used: '-1' }, { block_number: null }, { hash: 'bad' }, { nonce: null }])
    assert.throws(() => normalize(raw(1, extra), address), /receipt|transaction|nonce|block|hash/i);
  assert.equal(normalize(raw(1, { from: { hash: '0x'+'cd'.repeat(20) } }), address), null);
  assert.equal(normalize(raw(1, { timestamp: '2021-01-02T00:30:00+02:00' }), address).day, '2021-01-01');
});
test('decimal prices parse into 8dp fixed point; row cents round half up and sum', () => {
  const price = fn('priceToUnits');
  assert.equal(price('1234.56789012'), 123456789012n);
  assert.equal(price('1e-8'), 1n);
  assert.equal(price('1234.567890125'), 123456789013n);
  for (const invalid of ['NaN', 'Infinity', '-1', '0', '<script>', '1e9999']) assert.throws(() => price(invalid), /price/i);
  const normalize = fn('normalizeTransaction');
  const rows = [normalize(raw(1, {gas_used:'1',gas_price:'5000000000000000'}),address), normalize(raw(2, {gas_used:'1',gas_price:'5000000000000000',status:'error'}),address)];
  const valued = fn('valueRows')(rows, new Map([['2021-01-01', {units:price('1'), provisional:false}]]));
  assert.deepEqual(valued.map(x=>String(x.usdCents)), ['1','1']);
  const totals = fn('summarize')(valued);
  assert.equal(totals.wei, 10000000000000000n); assert.equal(totals.usdCents,2n);
  assert.equal(totals.failedWei,5000000000000000n); assert.equal(totals.failedUsdCents,1n);
  assert.equal(totals.count,2); assert.equal(totals.failedCount,1);
});
test('missing prices retain ETH, null row USD and explicit missing day/count', () => {
  const rows = [fn('normalizeTransaction')(raw(1),address)];
  const valued = fn('valueRows')(rows,new Map());
  assert.equal(valued[0].usdCents,null);
  const sum = fn('summarize')(valued);
  assert.equal(sum.missingCount,1);assert.deepEqual([...sum.missingDays],['2021-01-01']);
  assert.equal(sum.wei,2592592569259245000n);assert.equal(sum.usdCents,0n);
  assert.equal(Gas.summarize([]).wei,0n);assert.equal(Gas.summarize([]).count,0);
});
test('actual complete public failed fixture matches exact captured wei and failed subset', () => {
  const rows = fixture.response.items.map(tx=>fn('normalizeTransaction')(tx,wallet));
  const sum = fn('summarize')(Gas.valueRows(rows,new Map()));
  assert.equal(String(sum.wei),fixture.expected.fee_wei);assert.equal(String(sum.failedWei),fixture.expected.failed_fee_wei);
  assert.equal(sum.count,34);assert.equal(sum.failedCount,10);
});
test('full pagination beyond 10,000 preserves sender, cutoff and unique self-transfers', async () => {
  const fetchWallet=fn('fetchWallet'); let page=0;
  const result=await fetchWallet(address,{cutoff:11000,asOf:'2026-10-30T00:00:00.000Z',request:async url=>{
    const u=new URL(url);assert.equal(u.searchParams.get('filter'),'from');
    const first=page++*50+1;const items=Array.from({length:50},(_,i)=>raw(first+i));
    return {items,next_page_params:page<202?{block_number:page,index:1}:null};
  }});
  assert.equal(result.rows.length,10100);assert.equal(result.complete,true);assert.equal(page,202);
});
test('checkpoint resume avoids duplicates and validates persisted receipt strings', async () => {
  const fetchWallet=fn('fetchWallet'); let saved;
  await assert.rejects(fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',onCheckpoint:cp=>{saved=structuredClone(cp)},request:async url=>{
    if(new URL(url).searchParams.has('index'))throw Error('offline');
    return {items:[raw(1),raw(2)],next_page_params:{index:2}};
  }}),/offline/);
  assert.equal(saved.complete,false);
  const result=await fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',checkpoint:saved,request:async()=>({items:[raw(2),raw(3)],next_page_params:null})});
  assert.equal(result.complete,true);assert.equal(result.rows.length,3);
  const corrupt=structuredClone(saved);corrupt.rows[0].feeWei='0';
  assert.throws(()=>fn('validateCheckpoint')(corrupt,address,10),/checkpoint/i);
});
test('terminal cursor with a nonce gap and repeated cursors are explicit incomplete errors', async () => {
  const fetchWallet=fn('fetchWallet');
  await assert.rejects(fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',request:async()=>({items:[raw(2)],next_page_params:null})}),/nonce|incomplete/i);
  await assert.rejects(fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',request:async()=>({items:[raw(1)],next_page_params:{index:1}})}),/cursor|incomplete/i);
});
test('cutoff excludes new blocks; cancellation does not complete a partial wallet',async()=>{
  const fetchWallet=fn('fetchWallet');
  const result=await fetchWallet(address,{cutoff:1,asOf:'2026-10-30T00:00:00.000Z',request:async()=>({items:[raw(2),raw(1)],next_page_params:null})});
  assert.equal(result.rows.length,1);
  const controller=new AbortController();controller.abort();
  await assert.rejects(fetchWallet(address,{cutoff:1,asOf:'2026-10-30T00:00:00.000Z',signal:controller.signal,request:async()=>({items:[],next_page_params:null})}),/abort|cancel/i);
});
test('public HTTP client retries 429 with Retry-After and exposes progress; finite budget',async()=>{
  const createClient=fn('createClient');let attempts=0;const waits=[];const updates=[];
  const client=createClient({pace:0,sleep:async ms=>waits.push(ms),random:()=>0,onProgress:message=>updates.push(message),fetch:async()=>{
    attempts++;return attempts===1?{ok:false,status:429,headers:new Headers({'Retry-After':'2'}),json:async()=>({})}:{ok:true,status:200,headers:new Headers(),json:async()=>({ok:true})};
  }});
  assert.equal((await client.get('https://example.org')).ok,true);assert.equal(attempts,2);assert.ok(waits.includes(2000));assert.ok(updates.some(x=>/retry|wait/i.test(x)));
  const failing=createClient({pace:0,sleep:async()=>{},random:()=>0,fetch:async()=>({ok:false,status:503,headers:new Headers(),json:async()=>({})})});
  await assert.rejects(failing.get('https://example.org'),/503|unavailable/i);
});
test('validated price cache ignores corruption, wrong-source, future, malformed and current-day entries',()=>{
  const validate=fn('validatePriceCache');const now=Date.parse('2026-10-30T02:00:00Z');
  const record={version:1,source:'coinbase-eth-usd-close',entries:{'2021-01-01':{units:'123456789012',bucket:1609459200,fetchedAt:'2026-10-29T00:00:00.000Z'}}};
  assert.equal(validate(JSON.stringify(record),now).size,1);
  for(const bad of ['{',JSON.stringify({...record,version:9}),JSON.stringify({...record,source:'other'})]) assert.equal(validate(bad,now).size,0);
  for(const entry of [{units:'-1'},{units:'no'},{bucket:1},{fetchedAt:'2030-01-01T00:00:00Z'}]){
    const bad=structuredClone(record);Object.assign(bad.entries['2021-01-01'],entry);assert.equal(validate(JSON.stringify(bad),now).size,0);
  }
});
test('load prices paginates bounded daily windows, filters overlaps and tolerates disabled storage',async()=>{
  const load=fn('loadPrices');let calls=0;
  const result=await load(['2015-10-01','2016-05-18','2021-01-01','2021-01-02'],{now:()=>Date.parse('2026-10-30T02:00:00Z'),storage:{getItem(){throw Error('disabled')},setItem(){throw Error('disabled')}},request:async url=>{
    calls++;const u=new URL(url);assert.equal(u.searchParams.get('granularity'),'86400');assert.ok((Date.parse(u.searchParams.get('end'))-Date.parse(u.searchParams.get('start')))/86400000<=299);
    return [[1463529600,1,2,1,10,5],[1609459200,1,2,1,20,5],[1609545600,1,2,1,30,5],[1609632000,1,2,1,99,5]];
  }});
  assert.equal(result.get('2016-05-18').units,1000000000n);assert.equal(result.get('2021-01-01').units,2000000000n);assert.equal(result.has('2015-10-01'),false);assert.equal(result.has('2021-01-03'),false);assert.ok(calls>=2);
});
test('terminal gap saves observed fees before reporting incomplete',async()=>{
  let saved;
  await assert.rejects(Gas.fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',onCheckpoint:cp=>{saved=cp},request:async()=>({items:[raw(2)],next_page_params:null})}),/incomplete/i);
  assert.ok(saved,'observed terminal page must be checkpointed');assert.equal(saved.complete,false);assert.equal(saved.rows.length,1);assert.equal(saved.rows[0].feeWei,'2592592569259245000');
});
test('restored complete checkpoints cannot bypass nonce-gap completeness validation',()=>{
  const row=Gas.normalizeTransaction(raw(2),address);
  const cp={version:2,address,cutoff:10,asOf:'2026-10-30T00:00:00.000Z',complete:true,cursor:null,rows:[Gas.serializeRow(row)],unresolved:[],seen:['{}'],pageCount:1};
  assert.throws(()=>Gas.validateCheckpoint(cp,address,10),/checkpoint/i);
});
test('same transaction changing its timestamp across pages cannot change daily USD silently',async()=>{
  let calls=0;
  await assert.rejects(Gas.fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',request:async()=>++calls===1?
    {items:[raw(1)],next_page_params:{index:1}}:{items:[raw(1,{timestamp:'2021-01-02T12:00:00.000Z'})],next_page_params:null}}),/changed|incomplete/i);
});
test('explicit unconfirmed rows are excluded while malformed confirmed receipts still fail',async()=>{
  const result=await Gas.fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',request:async()=>({items:[raw(2,{block_number:null,status:null,gas_used:null,gas_price:null}),raw(1)],next_page_params:null})});
  assert.equal(result.rows.length,1);assert.equal(result.complete,true);
  const bad=await Gas.fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',request:async()=>({items:[raw(1)],next_page_params:null}),getReceipt:async()=>({...verificationFor(raw(1)),receipt:{...verificationFor(raw(1)).receipt,gasUsed:null}})});
  assert.equal(bad.rows.length,0);assert.equal(bad.unresolved.length,1);assert.match(bad.unresolved[0].reason,/receipt/i);
});
test('completed checkpoints require consistent consumed-page metadata',()=>{
  const cp={version:2,address,cutoff:10,asOf:'2026-10-30T00:00:00.000Z',complete:true,cursor:null,rows:[],unresolved:[],seen:[],pageCount:0};
  assert.throws(()=>Gas.validateCheckpoint(cp,address,10),/checkpoint/i);
});
test('a nonce-gap snapshot can resolve on resume and its completed snapshot validates again',async()=>{
  let saved;
  await assert.rejects(Gas.fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',onCheckpoint:cp=>{saved=cp},request:async()=>({items:[raw(2)],next_page_params:null})}),/incomplete/i);
  const result=await Gas.fetchWallet(address,{cutoff:10,asOf:'2026-10-30T00:00:00.000Z',checkpoint:saved,request:async()=>({items:[raw(1),raw(2)],next_page_params:null})});
  assert.equal(result.complete,true);assert.equal(result.rows.length,2);assert.doesNotThrow(()=>Gas.validateCheckpoint(result.checkpoint,address,10));
});
test('untrusted candle times outside Date range are ignored and valid quotes survive',async()=>{
  const prices=await Gas.loadPrices(['2021-01-01'],{now:()=>Date.parse('2026-10-30T02:00:00Z'),request:async()=>[[864000000000000,1,1,1,123,1],[1609459200,1,1,1,12,1]]});
  assert.equal(prices.get('2021-01-01').units,1200000000n);
});
