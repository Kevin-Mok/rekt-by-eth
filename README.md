# Ethereum wallet gas spending

See what one or more Ethereum wallets paid to use the network, including failed transactions. This read-only static page combines exact receipt fees with historical daily ETH/USD prices, keeps missing data explicit, and preserves interrupted calculations locally. It is built for wallet owners who want an auditable answer without connecting a wallet or handing over credentials.

## Tech Stack And Why Chosen

- **One vanilla HTML/CSS/JavaScript file:** portable static hosting, no build, CDN, runtime dependencies or secret.
- **BigInt wei and fixed-point USD:** exact fee arithmetic and consistent per-transaction rounding.
- **Built-in Node tests:** exercise the shipped inline production logic without a second library that can drift.
- **Python/curl probes and public JSON fixtures:** reproducible source evidence without installed packages.

The calculation engine, minimalist landing page, monthly chart and CSV export are implemented. See the [active plan](plans/wallet-gas.md), [verification evidence](docs/verification.md), [API evidence](docs/source-verification.md) and [manual smoke checks](docs/smoke-tests.md).

## Open and use

Use a modern browser. Node 22+ is needed for the optional local server; the full test suite also needs Python 3. No npm install or build step.

Run `npm run dev` and open its printed localhost URL. If port 4317 is occupied, it automatically selects another port and preserves the existing listener. `node scripts/serve.mjs --port 4400` chooses another preferred port; `--plain` uses ASCII labels and `--help` explains the options. The server exposes only index.html. Any static host can serve that file; deployment is outside this task.

Paste full 0x addresses, separated by commas, spaces, semicolons or newlines. Address identity is case-insensitive; mixed-case EIP-55 checksums are **not verified**, and ENS names are rejected. Results appear below the input with exact ETH/wei, historical USD, failed subset and wallet breakdown. Empty wallets show zeros. Failed gas is already included in the total.

Cancel retains validated pages. Resume uses the saved indexed-block snapshot; Calculate captures a fresh cutoff. History remains partial until terminal pagination and integrity checks pass. Today’s USD price is provisional, while missing daily prices yield a visibly incomplete priced subtotal.

## Sources, precision and limits

- Transactions: [Ethereum Blockscout API v2](https://docs.blockscout.com/api-reference/get-address-transactions), sent filter and keyset pagination until the terminal cursor. No arbitrary 10,000-transaction cutoff. Blockscout provides metadata only. Every fee and failure status comes from an actual mainnet RPC receipt via dRPC, then PublicNode/LlamaRPC on failure; chain ID, hash, sender and block are checked. Explorer gas fields never determine fees. See [receipt evidence](docs/source-receipts.md).
- Prices: [Coinbase Exchange ETH-USD daily candles](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles), UTC daily close. Requests use windows shorter than 300 days. Full-window verification found 3,815 prices from 2016-05-18 through 2026-10-29, with absent 2016-05-21/22 buckets. Earlier and missing transaction days stay unpriced. No CryptoCompare, CoinGecko, Etherscan API or key is used.
- Exact fee: `BigInt(gasUsed) × BigInt(effectiveGasPrice)` in integer wei. ETH is formatted only for display. Prices are rounded to eight fixed decimal places; each transaction’s USD fee rounds half up to cents, then those row cents are summed. A failed subset is never added again. Daily closes estimate historical value rather than execution-time quotes.
- Confirmed canonical sent mainnet transactions only: incoming transactions, internal calls, transfer-event duplication and L2 fees are excluded. Pending transactions are excluded. Unverified receipts remain listed by hash with unknown fees excluded; they do not stop history enumeration. Resume retries them without re-fetching complete history.
- The explorer is the sole enumeration source. Indexing lag, reorgs and provider outages remain limitations. Nonce gaps can indicate truncated history **or EIP-7702 authorizations**; the page conservatively retains observed fees and flags history incomplete for review. Synthetic tests cover 10,100 transactions; that does not establish an exhaustive independent high-volume wallet audit.
- Enumeration and price requests are sequential; two individual receipt lookups can run concurrently. All calls are paced, cancellable and have finite retry budgets/timeouts. Visible progress and cancellation remain available. Available rate/reset/Retry-After headers inform backoff; headers not exposed by browser CORS cannot be read. Source availability/terms can change.

## Privacy and local storage

No keys, signing, wallet connection, transactions, analytics or backend. The browser sends public addresses to Blockscout and price dates to Coinbase, and transaction hashes to the selected RPC providers; those providers receive your IP address. Runtime dependencies are limited to these public data APIs.

Versioned validated daily prices and public wallet checkpoints remain in this browser until **Clear local data** removes this app’s price and snapshot keys (including its legacy snapshot key). Completed historical quotes persist; today’s provisional candle is never cached as final. Snapshots older than seven days require a new calculation. Malformed data is rejected, and unavailable/full storage keeps results usable in memory with a warning. Schema-2 checkpoints store validated receipt evidence plus unresolved identities at the cutoff/as-of time. Old explorer-derived snapshots require fresh calculation; no checkpoint guarantees immunity to chain reorgs.

## Verify

`npm test` runs built-in Node tests and seven Python source-probe regression cases. `node scripts/wallet-report.mjs --fixture small` replays the captured public failed sender through the production engine; `--fixture empty` shows zero behavior. Both are offline fixture replays, not current source-availability checks. `--plain` uses ASCII labels; `--help` prints usage.

Python 3 source checks: `python3 scripts/verify-receipts.py` validates saved independent receipts; `--live` refreshes them. `python3 scripts/verify-price-history.py` refreshes the full historical Coinbase range. `python3 scripts/verify-wallet-history.py` validates the saved partial high-volume diagnostic; `--live` resumes its cursor with bounded retries. All support `--plain` and `--help`; all current source probes also offer `--details` for raw diagnostics. Old probe-sources.py preserves obsolete diagnostics and is not a production dependency.

`python3 scripts/browser-check.py` runs controlled UI states through an installed chrome-devtools-axi against the local server. `--port` selects the printed server port, `--plain` uses ASCII and `--details` shows failure diagnostics. This optional developer browser tool is not needed by visitors. Live source checks are recorded separately in [verification](docs/verification.md). Physical mobile devices, non-Chromium engines and a real screen reader remain unverified.

## Future work

- CAD and other currencies via daily historical FX; USD is the only MVP currency.
- Additional independent transaction enumerators and price-provider failover. The current product pins Coinbase with explicit missing days.

## CSV and monthly chart

Download CSV exports the exact currently displayed snapshot, including partial/missing/provisional flags. The monthly USD chart uses the same row cents; failed USD is drawn inside total spending. Months with sent transactions are shown, unpriced fees stay outside the bars and carry a star, and an accessible monthly table provides exact values.

CSV has a uniform header and explicit `record_type`: `metadata`, `transaction`, `wallet_total`, `monthly_total`, `total`, plus `unverified` when receipts are unavailable. Reconcile by summing **transaction** rows against the single **total** record; do not sum every record type together. Empty input wallets still get a zero wallet_total. Failed fees are separate subset columns. Missing transaction USD/price cells are blank; aggregate USD is the priced subtotal with `usd_complete=false` when incomplete. Current-day values carry `provisional=true`. Unverified records have blank fee/USD cells; their hashes, reasons and counts remain explicit, and `receipts_complete=false`. Verified transaction rows include their RPC `receipt_source`. Snapshot chain ID, as-of UTC, indexed block, source, price semantics and rounding policy are included.

Wei and cents are decimal integer strings; ETH is an exact decimal string and USD has two decimals. Import wei, hashes and addresses as **text** in spreadsheet software to avoid its automatic numeric precision loss. Text cells are escaped and spreadsheet-formula prefixes neutralized. `node scripts/wallet-report.mjs --fixture small --csv /tmp/wallet-gas.csv` writes a reproducible offline fixture export; `--details` adds raw diagnostics only on a file-write failure.
