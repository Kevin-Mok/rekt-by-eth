import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
export function loadCore() {
  const html = existsSync('index.html') ? readFileSync('index.html', 'utf8') : '';
  const code = html.match(/<script id="gas-core">([\s\S]*?)<\/script>/)?.[1] || '';
  const context = vm.createContext({ URL, URLSearchParams, Date, BigInt, Map, Set, AbortController,
    DOMException, setTimeout, clearTimeout, console, fetch, structuredClone });
  vm.runInContext(code, context);
  return context.Gas || {};
}
export const RawGas = loadCore();
const actual = JSON.parse(readFileSync('fixtures/sources/restart-small-receipts.json')).receipts;
const receiptMap = new Map(actual.map(row => [row.hash.toLowerCase(), row.rpc.response.result]));
export function verificationFor(tx) {
  const sender=typeof tx.from==='string'?tx.from:tx.from?.hash;
  const receipt=receiptMap.get(tx.hash?.toLowerCase()) || {transactionHash:tx.hash,blockNumber:tx.block_number,from:sender,
    gasUsed:Object.hasOwn(tx,'gas_used')?tx.gas_used:'21000',effectiveGasPrice:Object.hasOwn(tx,'gas_price')?tx.gas_price:'123456789012345',status:!Object.hasOwn(tx,'status')?'0x1':tx.status==='ok'?'0x1':tx.status==='error'?'0x0':null};
  return {chainId:1,source:'https://eth.drpc.org',receipt};
}
export const Gas = {...RawGas,
  normalizeTransaction:typeof RawGas.normalizeTransaction==='function'?(tx,address,verification)=>RawGas.normalizeTransaction(tx,address,verification??verificationFor(tx)):undefined,
  fetchWallet:typeof RawGas.fetchWallet==='function'?(address,options)=>RawGas.fetchWallet(address,{getReceipt:async tx=>verificationFor(tx),...options}):undefined
};
export const address = '0x' + 'ab'.repeat(20);
export function raw(i = 1, extra = {}) {
  return { hash: '0x' + BigInt(i).toString(16).padStart(64, '0'), from: { hash: address },
    block_number: i, timestamp: '2021-01-01T12:00:00.000Z', gas_used: '21000',
    gas_price: '123456789012345', status: 'ok', nonce: i - 1, ...extra };
}
