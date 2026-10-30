# Keyless Ethereum mainnet source verification

The site enumerates sent transactions with Blockscout and values their receipt fees with Coinbase daily ETH/USD closes. This document records the public-source evidence, the limits it establishes, and the checks needed to reproduce it. The direct USD-only RESTART supersedes the earlier blocked investigation.

## Selected sources

| Purpose | Source | Evidence and limits |
| --- | --- | --- |
| Sent mainnet transactions | `https://eth.blockscout.com/api/v2/addresses/{address}/transactions?filter=from` | Two original 50-row pages reused; 100 unique hashes with continuous keyset cursor. Continue `next_page_params` until null; no arbitrary 10k cut. A further diagnostic captured 42 pages / 2,100 unique rows before HTTP500; that sample is explicitly partial. |
| Receipt-equivalent fee fields | Blockscout `gas_used`, `gas_price`, `status` | Independent dRPC chainId 1 and three real receipts match gasUsed, effectiveGasPrice, status, sender, block and exact wei. Legacy, EIP-1559 and failed samples covered; see [receipt evidence](source-receipts.md). Missing fields remain errors, never zero. |
| Historical ETH/USD | `https://api.exchange.coinbase.com/products/ETH-USD/candles?granularity=86400&start=...&end=...` | 14 windows of at most 299 days returned 3,815 daily closes through 2026-10-29. First day 2016-05-18; internal absent days 2016-05-21 and 2016-05-22. No missing value synthesized. |
| Independent receipt cross-check | `https://eth.drpc.org` JSON-RPC | Keyless mainnet chain and three non-null receipts. PublicNode/Llama TLS failed locally; Ankr required authentication. dRPC replaces them for verification only. |

Successful Coinbase, Blockscout and dRPC curl responses include CORS `*` for local Origin. Actual served-page fetch/CORS acceptance is deferred to Stage 3. Do not infer browser header exposure from curl. Rate-limit headers may not be exposed; conservative pacing and visible finite backoff are required.

## Coverage and meaning

`fixtures/sources/restart-price-history.json` records each request URL, selected response headers, counts, time boundaries and exact decimal closes. The full available range was requested, not inferred from an old sample. Coinbase candles are `[UTC bucket start, low, high, open, close, volume]`; close is the last trade in that daily bucket. Extra buckets returned outside the request are filtered. A no-trade day may be absent. Today is provisional and never persisted as a final daily quote.

Vitalik's public fixture first sent transaction is nonce 0, block 318528, 2015-10-01T18:08:05Z. Its date was verified with an ascending keyless Blockscout v1 sample solely for first-date evidence (`restart-earliest-day.json`); production enumeration remains v2. Its pre-2016-05-18 transaction days cannot be priced by Coinbase and MUST remain missing. Fetching all Coinbase windows back to Ethereum launch verified that earlier candles are absent. No complete USD total is claimed for such wallets.

Prices are fixed-point USD at eight decimals; fees remain BigInt integer wei. Round each transaction's fee × daily close to cents, half up, then sum those cents identically for summaries, failed subsets, wallet table, CSV and monthly chart. Daily-close values are historical estimates, not execution-time exchange rates or tax advice. Explicit missing-price rows retain exact ETH fees and yield an incomplete priced subtotal.

## Pagination and availability

Original pages preserve actual `x-ratelimit-limit/remaining/reset` headers (observed limit 180). The website must honor available reset/Retry-After values, pace requests, retry transient 429/5xx/network failures finitely, atomically save validated rows/cursors, and detect repeated cursors. A failed page may not mark history complete or silently drop rows. Synthetic >10k continuation/resume tests are Stage 2; an exhaustive high-volume wallet audit is not established by the two-page capture.

The explorer remains the sole enumeration source. Sampled RPC matches validate semantics, not every explorer record, indexing completeness, reorgs or uptime. No keys, paid APIs, backend, Etherscan dependency or L2 fees. Etherscan is optional manual cross-check only. CryptoCompare/CoinGecko failures are preserved historical diagnostics; neither is retried or used. Other currencies via daily FX are future work.

## Primary documentation and attribution

- [Coinbase candle endpoint](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles): maximum 300 candles/request, bounded date windows, possible absent buckets, daily granularity 86400. UI names Coinbase Exchange and links it.
- [Blockscout address transactions](https://docs.blockscout.com/api-reference/get-address-transactions): from/to filter, transaction fields, `next_page_params`. UI names and links Ethereum Blockscout.
- API documentation alone does not grant an unrestricted data redistribution license. This app retrieves public data directly for the visitor; source terms continue to apply. No bundled market dataset is used by the product. The committed public prices are verification evidence.

## Reproduce

Python 3 and curl suffice for public probes; use `--help` for flags and `--plain` for ASCII progress. `verify-receipts.py` verifies saved evidence offline; `--live` refreshes three receipts. `verify-price-history.py` requests all historical date windows. `verify-wallet-history.py` is a diagnostic continuation and may take time; partial captures must never be presented as complete. Source probes are separate from the static app and are not loaded at runtime.

## Complete public fixtures

`fixtures/public-wallets.json` identifies a small public failed sender and an empty address; neither is a product default. `restart-small-wallet.json` captures terminal v2 history: 34 sent transactions (nonces 0–33), 10 failed, total 96164252494628845 wei, failed subset 39629962723545907 wei, first sent 2025-10-10T19:51:23Z, cutoff block 26302568. Two failed receipts also match independent dRPC fields. The empty address returns no rows and a null cursor. Its complete 34-row history falls within the verified Coinbase range; any current-day candle remains provisional.
