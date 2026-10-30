import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Gas,raw,address } from './load-core.mjs';
const fn=name=>{assert.equal(typeof Gas[name],'function',`${name} must be implemented in the inline production core`);return Gas[name];};
const meta={asOf:'2026-10-30T00:00:00.000Z',cutoff:10,addresses:[address,'0x'+'cd'.repeat(20)],historyComplete:true};
function parseCsv(text){
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  const header=rows.shift();return rows.filter(r=>r.length>1).map(r=>Object.fromEntries(header.map((k,i)=>[k,r[i]])));
}
function valued(){return Gas.valueRows([Gas.normalizeTransaction(raw(1,{gas_used:'1',gas_price:'5000000000000000'}),address),Gas.normalizeTransaction(raw(2,{gas_used:'1',gas_price:'15000000000000000',status:'error',timestamp:'2021-02-01T00:00:00Z'}),address)],new Map([['2021-01-01',{units:Gas.priceToUnits('1')}],['2021-02-01',{units:Gas.priceToUnits('1')}]]));}
test('CSV quotes untrusted text and neutralizes spreadsheet formulas',()=>{
  const cell=fn('csvCell');assert.equal(cell('hello,"world"\nnext'),'"hello,""world""\nnext"');
  for(const value of ['=1+1','+cmd','-cmd','@SUM(A1)','  =SUM(A1)'])assert.ok(cell(value).startsWith("'"));
});
test('CSV transaction rows reconcile exactly in wei, ETH and cents including failed subset',()=>{
  const exportCsv=fn('exportCsv'),rows=valued(),csv=exportCsv(rows,meta),parsed=parseCsv(csv);
  const transactions=parsed.filter(r=>r.record_type==='transaction'),total=parsed.find(r=>r.record_type==='total');
  assert.equal(transactions.length,2);assert.equal(total.fee_wei,'20000000000000000');assert.equal(total.fee_eth,'0.02');
  assert.equal(total.usd_cents,'3');assert.equal(total.usd,'0.03');assert.equal(total.failed_fee_wei,'15000000000000000');assert.equal(total.failed_usd_cents,'2');
  assert.equal(transactions.reduce((s,r)=>s+BigInt(r.fee_wei),0n),BigInt(total.fee_wei));
  assert.equal(transactions.reduce((s,r)=>s+BigInt(r.usd_cents),0n),BigInt(total.usd_cents));
  for(const row of transactions){assert.equal(row.fee_eth,Gas.formatEth(BigInt(row.fee_wei)));assert.equal(row.chain_id,'1');assert.equal(row.currency,'USD');assert.equal(row.as_of_utc,meta.asOf);assert.equal(row.cutoff_block,'10');}
  const empty=parsed.find(r=>r.record_type==='wallet_total'&&r.wallet===meta.addresses[1]);assert.equal(empty.fee_wei,'0');assert.equal(empty.sent_count,'0');
});
test('CSV missing USD cells stay blank, and partial/missing summary is explicitly incomplete',()=>{
  const rows=Gas.valueRows([Gas.normalizeTransaction(raw(1,{status:'error'}),address)],new Map());
  const parsed=parseCsv(fn('exportCsv')(rows,{...meta,historyComplete:false}));
  const tx=parsed.find(r=>r.record_type==='transaction'),total=parsed.find(r=>r.record_type==='total');
  assert.equal(tx.usd,'');assert.equal(tx.usd_cents,'');assert.equal(tx.price_usd_8dp,'');assert.equal(tx.history_complete,'false');
  assert.equal(total.usd_complete,'false');assert.equal(total.missing_price_count,'1');assert.equal(total.failed_usd_complete,'false');
  assert.equal(total.failed_fee_wei,total.fee_wei);
});
test('monthly buckets use UTC days and sum the exact per-row cents used by CSV/page',()=>{
  const monthly=fn('monthlyTotals')(valued());assert.equal(monthly.length,2);assert.equal(monthly[0].month,'2021-01');assert.equal(monthly[0].usdCents,1n);assert.equal(monthly[1].usdCents,2n);assert.equal(monthly[1].failedUsdCents,2n);
  assert.equal(monthly.reduce((s,m)=>s+m.usdCents,0n),Gas.summarize(valued()).usdCents);
  const missing=Gas.valueRows([Gas.normalizeTransaction(raw(1),address)],new Map());assert.equal(Gas.monthlyTotals(missing)[0].missingCount,1);assert.equal(Gas.monthlyTotals([]).length,0);
});
test('actual public CSV fixture reconciles total and failed exact wei with partial USD',()=>{
  const exportCsv=fn('exportCsv'),data=JSON.parse(readFileSync('fixtures/sources/restart-small-wallet.json')),
    prices=JSON.parse(readFileSync('fixtures/sources/restart-price-history.json')),wallet=data.response.items[0].from.toLowerCase();
  const quotes=new Map(Object.entries(prices.prices).map(([d,p])=>[d,{units:Gas.priceToUnits(p)}]));
  const rows=Gas.valueRows(data.response.items.map(tx=>Gas.normalizeTransaction(tx,wallet)),quotes);
  const parsed=parseCsv(exportCsv(rows,{...meta,addresses:[wallet],cutoff:data.expected.cutoff_block}));
  const txs=parsed.filter(r=>r.record_type==='transaction'),total=parsed.find(r=>r.record_type==='total');
  assert.equal(txs.length,34);assert.equal(total.fee_wei,data.expected.fee_wei);assert.equal(total.failed_fee_wei,data.expected.failed_fee_wei);assert.equal(total.failed_count,'10');
  assert.equal(total.usd,'92.42');assert.equal(total.missing_price_count,'28');assert.equal(total.usd_complete,'false');
  assert.equal(txs.filter(r=>r.status==='failed').reduce((s,r)=>s+BigInt(r.fee_wei),0n),BigInt(total.failed_fee_wei));
});
export {parseCsv};
test('CSV exports more than 10,000 exact rows without a fiat or fee truncation',()=>{
  const rows=Gas.valueRows(Array.from({length:10001},(_,i)=>Gas.normalizeTransaction(raw(i+1,{gas_used:'1',gas_price:'5000000000000000'}),address)),new Map([['2021-01-01',{units:Gas.priceToUnits('1')}]]));
  const parsed=parseCsv(Gas.exportCsv(rows,{...meta,cutoff:11000})),transactions=parsed.filter(row=>row.record_type==='transaction'),total=parsed.find(row=>row.record_type==='total');
  assert.equal(transactions.length,10001);assert.equal(total.usd_cents,'10001');assert.equal(total.fee_wei,String(10001n*5000000000000000n));
});
