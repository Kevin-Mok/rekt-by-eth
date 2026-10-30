# Keyless Ethereum source verification

The site uses Blockscout to enumerate sent mainnet transactions, public RPC receipts for exact fees, and Coinbase daily ETH/USD closes for historical estimates. This document records what was actually verified and where data remains incomplete; no missing value is guessed.

## Selected sources

| Purpose | Source | Verified behavior and limits |
| --- | --- | --- |
| Transaction enumeration | Ethereum Blockscout API v2 `/addresses/{address}/transactions?filter=from` | Original two 50-row pages reused. Follow next_page_params until null, detect repeated cursors, preserve checkpoints. The diagnostic 42-page/2,100-row high-volume capture remains partial after HTTP500. |
| Exact fees and failure status | dRPC, PublicNode, LlamaRPC | Every runtime fee uses an actual receipt after chain ID 1 and transaction hash/sender/block checks. Null/bad receipts try another provider. Unknown fees remain listed and excluded; see [receipt authority](source-receipts.md). |
| Historical USD | Coinbase Exchange ETH-USD candles, granularity 86400 | Fourteen bounded windows yielded 3,815 daily closes through 2026-10-29. First day 2016-05-18; absent 2016-05-21/22. Earlier/gap days stay unpriced. |

The actual served page successfully fetched Blockscout, Coinbase and dRPC through browser CORS. This proves those observed requests, not perpetual uptime or every fallback origin. Curl showed CORS `*`; rate headers may still be hidden by browser exposure rules.

## Price coverage and meaning

`fixtures/sources/restart-price-history.json` retains request URLs, selected response headers, counts, bucket bounds and decimal closes. The full available range was requested, rather than inferred from an old sample. Coinbase rows are `[UTC bucket start, low, high, open, close, volume]`; close is the last trade in the bucket. Filter extra buckets outside the requested window; intervals with no trades may be absent. Today is provisional and never cached as a final quote.

Vitalik's public fixture first sent transaction is nonce 0, block 318528, 2015-10-01T18:08:05Z. An ascending keyless Blockscout v1 sample established only that first date (`restart-earliest-day.json`); production enumeration is v2. Pre-2016-05-18 transaction days cannot be priced by the selected source. The UI retains their exact receipt fees and labels USD incomplete.

Prices use eight fixed decimal places. Round each receipt fee × daily close to cents, half up, then sum row cents identically in the page, failed subset, CSV and monthly chart. Daily close estimates differ from execution-time prices. Missing USD cells stay blank; aggregate USD is explicitly a priced subtotal when incomplete.

## Complete public fixtures

`fixtures/public-wallets.json` identifies a small failed sender and an empty address, never product defaults. `restart-small-wallet.json` captures terminal history: 34 sent transactions, nonces 0–33, 10 failed, first sent 2025-10-10T19:51:23Z, cutoff block 26302568. Every fee now matches a saved actual mainnet receipt. Exact totals are 96164252494628845 wei and 39629962723545907 failed wei. The empty address has no rows and null cursor. Later live counts can increase; compare snapshots at the same cutoff.

## Pagination and resilience

Original responses preserve observed x-ratelimit-limit/remaining/reset headers (limit 180). The app paces requests, honors available reset/Retry-After values, retries finitely, allows cancellation and saves validated identities, receipt state and cursors. It has no 10,000-row cutoff. Synthetic 10,100-row continuation and 10,001-row CSV tests establish algorithm behavior; they do not prove exhaustive independent production enumeration.

Nonce gaps may mean missing history or EIP-7702 authorizations. They conservatively prevent a complete-history claim while retaining observed receipt fees. Missing receipts are a separate state: enumeration can finish while known-fee totals still exclude listed unverified hashes. A failed receipt is tried once per calculation, then retried only on explicit resume; later pages do not multiply its retry budget.

Blockscout remains the sole enumerator. Source outages, index lag, reorgs and public-provider trust remain limitations. No keys, paid APIs, Etherscan dependency, L2 fees or backend. CryptoCompare/CoinGecko failures are historical evidence only; neither is retried. Other currencies via daily FX are future work.

## Primary documentation and attribution

- [Coinbase candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles): maximum 300 candles per request, bounded date windows, absent buckets and daily granularity. The UI names Coinbase Exchange.
- [Blockscout address transactions](https://docs.blockscout.com/api-reference/get-address-transactions): sent filter, transaction metadata and keyset cursors. The UI links Ethereum Blockscout.
- API documentation does not grant unrestricted redistribution rights. The app retrieves public data directly for the visitor; provider terms apply. Committed price/receipt data are verification fixtures, not a bundled product feed.

## Reproduce

Python 3 and curl suffice for source probes. `verify-receipts.py` checks captured samples offline; `--live` refreshes three receipts. `verify-price-history.py` validates all historical windows before atomically replacing evidence: failed/malformed/empty refreshes exit nonzero and preserve prior bytes. It supports `--plain` and `--details`. `verify-wallet-history.py` validates the saved partial paging diagnostic; `--live` resumes it. Source scripts are not loaded by the site.
