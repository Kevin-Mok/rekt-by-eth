#!/usr/bin/env node
// Exercise the shipped inline engine; this is a verifier, not a runtime dependency.
import { readFileSync } from 'node:fs';
import { Gas } from '../tests/load-core.mjs';
const args=process.argv.slice(2),plain=args.includes('--plain'),label=plain?'[gas]':'⛽';
if(args.includes('--help')) {
  console.log(`${label} Wallet gas verification\nUsage: node scripts/wallet-report.mjs --fixture small|empty [--plain]\nReplays captured public data through the production engine without network access.`);
  process.exit(0);
}
const name=args[args.indexOf('--fixture')+1];
if(!args.includes('--fixture') || !['small','empty'].includes(name)) {console.error(`${label} Choose --fixture small or --fixture empty; see --help.`);process.exit(1);}
const fixture=JSON.parse(readFileSync(new URL('../fixtures/sources/restart-small-wallet.json',import.meta.url)));
const wallets=JSON.parse(readFileSync(new URL('../fixtures/public-wallets.json',import.meta.url)));
const prices=JSON.parse(readFileSync(new URL('../fixtures/sources/restart-price-history.json',import.meta.url)));
const address=(name==='small'?wallets.small_failed.address:wallets.empty.address).toLowerCase();
const items=name==='small'?fixture.response.items:[];
const history=await Gas.fetchWallet(address,{cutoff:wallets.small_failed.cutoff_block,asOf:wallets.captured_at,request:async()=>({items,next_page_params:null})});
const quotes=new Map(Object.entries(prices.prices).map(([day,price])=>[day,{units:Gas.priceToUnits(price),provisional:false}]));
const rows=Gas.valueRows(history.rows,quotes),total=Gas.summarize(rows);
console.log(`${label} Captured ${name} wallet; complete sent history at block ${wallets.small_failed.cutoff_block}`);
console.log(`${label} Sent ${total.count}; failed ${total.failedCount}; fee ${total.wei} wei (${Gas.formatEth(total.wei)} ETH)`);
console.log(`${label} Failed subset ${total.failedWei} wei; already included in total`);
console.log(`${label} USD ${Gas.formatUsd(total.usdCents)}${total.missingCount?' priced subtotal; INCOMPLETE':''}; missing prices ${total.missingCount} transactions / ${total.missingDays.length} UTC days`);
