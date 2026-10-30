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
export const Gas = loadCore();
export const address = '0x' + 'ab'.repeat(20);
export function raw(i = 1, extra = {}) {
  return { hash: '0x' + BigInt(i).toString(16).padStart(64, '0'), from: { hash: address },
    block_number: i, timestamp: '2021-01-01T12:00:00.000Z', gas_used: '21000',
    gas_price: '123456789012345', status: 'ok', nonce: i - 1, ...extra };
}
