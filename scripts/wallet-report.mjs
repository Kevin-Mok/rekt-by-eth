#!/usr/bin/env node
// Exercise the shipped inline engine; this is a verifier, not a runtime dependency.
import { readFileSync, writeFileSync } from 'node:fs';
import { RawGas as Gas } from '../tests/load-core.mjs';
const args=process.argv.slice(2),plain=args.includes('--plain'),label=plain?'[gas]':'⛽';
if(args.includes('--help')) {
  console.log(`${label} Wallet gas verification\nUsage: node scripts/wallet-report.mjs --fixture small|empty [--csv PATH] [--plain] [--details]\nReplays captured public data through the production engine without network access.`);
  process.exit(0);
}
const name=args[args.indexOf('--fixture')+1];
if(!args.includes('--fixture') || !['small','empty'].includes(name)) {console.error(`${label} Choose --fixture small or --fixture empty; see --help.`);process.exit(1);}
const fixture=JSON.parse(readFileSync(new URL('../fixtures/sources/restart-small-wallet.json',import.meta.url)));
const wallets=JSON.parse(readFileSync(new URL('../fixtures/public-wallets.json',import.meta.url)));
const prices=JSON.parse(readFileSync(new URL('../fixtures/sources/restart-price-history.json',import.meta.url)));
const address=(name==='small'?wallets.small_failed.address:wallets.empty.address).toLowerCase();
const items=name==='small'?fixture.response.items:[];
const receiptData=JSON.parse(readFileSync(new URL('../fixtures/sources/restart-small-receipts.json',import.meta.url)));
const receipts=new Map(receiptData.receipts.map(row=>[row.hash.toLowerCase(),row.rpc.response.result]));
const history=await Gas.fetchWallet(address,{cutoff:wallets.small_failed.cutoff_block,asOf:wallets.captured_at,request:async()=>({items,next_page_params:null}),getReceipt:async tx=>({chainId:1,source:'https://eth.drpc.org',receipt:receipts.get(tx.hash.toLowerCase())})});
const quotes=new Map(Object.entries(prices.prices).map(([day,price])=>[day,{units:Gas.priceToUnits(price),provisional:false}]));
const rows=Gas.valueRows(history.rows,quotes),total=Gas.summarize(rows);
console.log(`${label} Captured ${name} wallet; complete sent history at block ${wallets.small_failed.cutoff_block}`);
console.log(`${label} Sent ${total.count}; failed ${total.failedCount}; fee ${total.wei} wei (${Gas.formatEth(total.wei)} ETH)`);
console.log(`${label} Failed subset ${total.failedWei} wei; already included in total`);
console.log(`${label} USD ${Gas.formatUsd(total.usdCents)}${total.missingCount?' priced subtotal; INCOMPLETE':''}; missing prices ${total.missingCount} transactions / ${total.missingDays.length} UTC days`);

if(args.includes('--csv')) {
  const path=args[args.indexOf('--csv')+1];
  if(!path || path.startsWith('--')){console.error(`${label} --csv requires an output path.`);process.exit(1);}
  const csv=Gas.exportCsv(rows,{asOf:wallets.captured_at,cutoff:wallets.small_failed.cutoff_block,addresses:[address],historyComplete:true});
  try{writeFileSync(path,csv);}catch(error){console.error(`${label} Could not write CSV. Choose a writable file path.${args.includes('--details')?' '+error.message:''}`);process.exit(1);}
  console.log(`${label} CSV saved: ${path}; transaction, wallet, monthly and total records share exact row amounts.`);
}
