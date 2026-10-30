import test from 'node:test';
import assert from 'node:assert/strict';
import {RawGas as G,raw,address,verificationFor} from './load-core.mjs';
const asOf='2026-10-30T00:00:00.000Z';
const receipt=(tx=raw(1),extra={})=>({...verificationFor(tx),receipt:{...verificationFor(tx).receipt,...extra}});
test('explorer zero gas and advertised maxfee never determine exact receipt fee',async()=>{
  const tx=raw(1,{gas_used:'0',gas_price:'60000000000'}),verified=receipt(tx,{gasUsed:'0x5208',effectiveGasPrice:'57539225234',status:'0x1'});
  const row=G.normalizeTransaction(tx,address,verified);
  assert.equal(row.feeWei,1208323729914000n);assert.equal(row.receiptSource,'https://eth.drpc.org');
  const result=await G.fetchWallet(address,{cutoff:10,asOf,request:async()=>({items:[tx],next_page_params:null}),getReceipt:async()=>verified});
  assert.equal(result.complete,true);assert.equal(result.rows[0].feeWei,1208323729914000n);assert.equal(result.unresolved.length,0);
});
test('normalization requires mainnet actual receipt identity and status',()=>{
  const tx=raw(1);assert.throws(()=>G.normalizeTransaction(tx,address),/receipt/i);
  for(const bad of [null,receipt(tx,{transactionHash:raw(2).hash}),receipt(tx,{from:'0x'+'cd'.repeat(20)}),receipt(tx,{blockNumber:2}),receipt(tx,{gasUsed:null}),receipt(tx,{effectiveGasPrice:null}),receipt(tx,{status:null}),{...receipt(tx),chainId:2}])
    assert.throws(()=>G.normalizeTransaction(tx,address,bad),/receipt|mainnet/i);
  const failed=G.normalizeTransaction(tx,address,receipt(tx,{status:'0x0'}));assert.equal(failed.failed,true);
});
test('empty/invalid first RPC receipt falls through to a second mainnet RPC',async()=>{
  assert.equal(typeof G.createReceiptClient,'function');const calls=[];const tx=raw(1);
  const client=G.createReceiptClient({pace:0,sleep:async()=>{},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,method:body.method});
    const result=body.method==='eth_chainId'?'0x1':url==='https://eth.drpc.org'?null:receipt(tx).receipt;
    return {ok:true,status:200,headers:new Headers(),json:async()=>({jsonrpc:'2.0',id:1,result})};
  }});
  const result=await client.getReceipt(tx);
  assert.equal(result.source,'https://ethereum-rpc.publicnode.com');assert.ok(calls.some(c=>c.method==='eth_getTransactionReceipt'&&c.url==='https://ethereum-rpc.publicnode.com'));
  assert.ok(calls.every(c=>['eth_chainId','eth_getTransactionReceipt'].includes(c.method)));
});
test('wrong-chain provider cannot supply a fee',async()=>{
  assert.equal(typeof G.createReceiptClient,'function');const tx=raw(1),calls=[];
  const client=G.createReceiptClient({pace:0,sleep:async()=>{},fetch:async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,method:body.method});return {ok:true,status:200,headers:new Headers(),json:async()=>({result:body.method==='eth_chainId'?(url==='https://eth.drpc.org'?'0x89':'0x1'):receipt(tx).receipt})};
  }});
  const verified=await client.getReceipt(tx);assert.equal(verified.chainId,1);assert.notEqual(verified.source,'https://eth.drpc.org');
  assert.equal(calls.some(c=>c.url==='https://eth.drpc.org'&&c.method==='eth_getTransactionReceipt'),false);
});
test('all receipt sources failing preserves unverified hashes, continues paging and excludes unknown money',async()=>{
  let calls=0;
  const result=await G.fetchWallet(address,{cutoff:10,asOf,request:async()=>++calls===1?{items:[raw(2)],next_page_params:{index:1}}:{items:[raw(1)],next_page_params:null},getReceipt:async tx=>{if(tx.hash===raw(2).hash)throw Error('No receipt from any source');return receipt(tx);}});
  assert.equal(calls,2);assert.equal(result.complete,true);assert.equal(result.rows.length,1);assert.equal(result.unresolved.length,1);assert.equal(result.unresolved[0].hash,raw(2).hash);
  assert.equal(G.summarize(result.rows).wei,2592592569259245000n);assert.match(result.unresolved[0].reason,/receipt/i);
  assert.doesNotThrow(()=>G.validateCheckpoint(result.checkpoint,address,10));
});
test('complete history resumes only missing receipts without history refetch or duplicate fees',async()=>{
  const first=await G.fetchWallet(address,{cutoff:10,asOf,request:async()=>({items:[raw(1),raw(2)],next_page_params:null}),getReceipt:async tx=>{if(tx.hash===raw(2).hash)throw Error('temporary');return receipt(tx);}});
  const looked=[];
  const resumed=await G.fetchWallet(address,{cutoff:10,asOf,checkpoint:first.checkpoint,request:async()=>{throw Error('must not refetch history');},getReceipt:async tx=>{looked.push(tx.hash);return receipt(tx);}});
  assert.equal(resumed.rows.length,2);assert.equal(resumed.unresolved.length,0);assert.deepEqual(looked,[raw(2).hash]);assert.equal(resumed.checkpoint.version,2);
  const old={...resumed.checkpoint,version:1};assert.throws(()=>G.validateCheckpoint(old,address,10),/checkpoint/i);
});
test('unverified receipt rows are explicit in CSV and cannot become zero-valued transactions',async()=>{
  const data=await G.fetchWallet(address,{cutoff:10,asOf,request:async()=>({items:[raw(1)],next_page_params:null}),getReceipt:async()=>{throw Error('no receipt');}});
  const csv=G.exportCsv([], {asOf,cutoff:10,addresses:[address],historyComplete:true,unresolved:data.unresolved});
  assert.ok(csv.includes('unverified'));assert.ok(csv.includes(raw(1).hash));assert.ok(csv.includes('receipts_complete'));
  assert.equal(data.rows.length,0);
});
test('a failed receipt is tried once per calculation, not again for every later page',async()=>{
  let page=0;const attempts=new Map();
  const result=await G.fetchWallet(address,{cutoff:10,asOf,request:async()=>++page===1?{items:[raw(2)],next_page_params:{index:1}}:{items:[raw(1),raw(3)],next_page_params:null},getReceipt:async tx=>{attempts.set(tx.hash,(attempts.get(tx.hash)||0)+1);if(tx.hash===raw(2).hash)throw Error('unavailable');return receipt(tx);}});
  assert.equal(result.complete,true);assert.equal(result.unresolved.length,1);assert.equal(attempts.get(raw(2).hash),1);
});
test('conflicting duplicate metadata within one page cannot overwrite the USD day',async()=>{
  await assert.rejects(G.fetchWallet(address,{cutoff:10,asOf,request:async()=>({items:[raw(1),raw(1,{timestamp:'2022-01-01T12:00:00.000Z'})],next_page_params:null}),getReceipt:async tx=>receipt(tx)}),/changed|conflict/i);
});
test('concurrent fallback lookups each visit their own provider order without skipping a working RPC',async()=>{
  let releaseA;const held=new Promise(resolve=>{releaseA=resolve}),a=raw(1),b=raw(2),calls=[];
  const client=G.createReceiptClient({pace:0,sleep:async()=>{},fetch:async(url,options)=>{
    const rpc=JSON.parse(options.body);let result='0x1';
    if(rpc.method==='eth_getTransactionReceipt'){
      const hash=rpc.params[0];calls.push({url,hash});
      if(url==='https://eth.drpc.org')result=hash===a.hash?await held:null;
      else if(url==='https://ethereum-rpc.publicnode.com')result=receipt(hash===a.hash?a:b).receipt;
      else result=null;
    }
    return {ok:true,status:200,headers:new Headers(),json:async()=>({result})};
  }});
  const lookupA=client.getReceipt(a),lookupB=client.getReceipt(b);
  assert.equal((await lookupB).source,'https://ethereum-rpc.publicnode.com');releaseA(null);
  assert.equal((await lookupA).source,'https://ethereum-rpc.publicnode.com');
  const providersA=calls.filter(call=>call.hash===a.hash).map(call=>call.url);
  assert.equal(providersA.length,new Set(providersA).size);
});
