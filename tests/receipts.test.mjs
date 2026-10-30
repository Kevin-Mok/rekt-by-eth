import test from 'node:test';
import assert from 'node:assert/strict';
import { Gas, address, raw } from './load-core.mjs';

const hashOf = i => '0x' + BigInt(i).toString(16).padStart(64, '0');
const receiptBody = (hash, gasUsed, price, status = '0x1') => ({ jsonrpc: '2.0', id: 1,
  result: { transactionHash: hash, status, gasUsed, effectiveGasPrice: price } });
const rpcResponse = body => ({ ok: true, status: 200, json: async () => body });
const noSleep = async () => {};

test('Blockscout gas_used 0 and max-fee gas_price do not matter: fee comes from the receipt', async () => {
  const row = raw(1, { gas_used: '0', gas_price: '60000000000', status: 'ok' });
  const calls = [];
  const reader = Gas.createReceiptReader({ rpcs: ['https://rpc.one'], sleep: noSleep, fetch: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return rpcResponse(receiptBody(row.hash, '0x5208', '0xd659ae692'));
  } });
  const result = await Gas.fetchWallet(address, { cutoff: 10, asOf: '2026-10-30T00:00:00.000Z', receipt: reader.read,
    request: async () => ({ items: [row], next_page_params: null }) });
  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].gasUsed, '21000');
  assert.equal(result.rows[0].gasPrice, '57539225234');
  assert.equal(result.rows[0].feeWei.toString(), (21000n * 57539225234n).toString());
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.method, 'eth_getTransactionReceipt');
  assert.ok(!Array.isArray(calls[0].body), 'one receipt per request, never a batch');
});

test('an empty receipt on one provider falls through to the next provider', async () => {
  const hash = hashOf(7);
  const seen = [];
  const reader = Gas.createReceiptReader({ rpcs: ['https://empty.rpc', 'https://good.rpc'], sleep: noSleep, fetch: async url => {
    seen.push(url);
    return url.includes('empty') ? rpcResponse({ jsonrpc: '2.0', id: 1, result: null }) : rpcResponse(receiptBody(hash, '0x5208', '0x3b9aca00'));
  } });
  const receipt = await reader.read(hash);
  assert.deepEqual(seen, ['https://empty.rpc', 'https://good.rpc']);
  assert.equal(receipt.gasUsed, '21000');
  assert.equal(receipt.gasPrice, '1000000000');
  assert.equal(receipt.status, 'ok');
});

test('the receipt status wins when Blockscout says ok for a reverted transaction', async () => {
  const row = raw(1, { status: 'ok', gas_used: '28887', gas_price: '1' });
  const reader = Gas.createReceiptReader({ rpcs: ['https://rpc.one'], sleep: noSleep,
    fetch: async () => rpcResponse(receiptBody(row.hash, '0x70d7', '0x3b9aca00', '0x0')) });
  const result = await Gas.fetchWallet(address, { cutoff: 10, asOf: '2026-10-30T00:00:00.000Z', receipt: reader.read,
    request: async () => ({ items: [row], next_page_params: null }) });
  assert.equal(result.rows[0].failed, true);
  assert.equal(result.rows[0].feeWei.toString(), (28887n * 1000000000n).toString());
});

test('when every provider fails, the wallet stops and says so instead of guessing a fee', async () => {
  const reader = Gas.createReceiptReader({ rpcs: ['https://a.rpc', 'https://b.rpc'], sleep: noSleep,
    fetch: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
  await assert.rejects(reader.read(hashOf(3)), /unavailable on every provider/);
});

test('zero gasUsed, malformed hex and foreign receipts are rejected', async () => {
  const hash = hashOf(9);
  for (const body of [receiptBody(hash, '0x0', '0x1'), receiptBody(hash, '21000', '0x1'), receiptBody(hashOf(10), '0x5208', '0x1'),
    { jsonrpc: '2.0', id: 1, error: { message: 'rate limited' } }]) {
    const reader = Gas.createReceiptReader({ rpcs: ['https://rpc.one'], sleep: noSleep, fetch: async () => rpcResponse(body) });
    await assert.rejects(reader.read(hash));
  }
});
