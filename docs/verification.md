# Wallet gas verification

This record separates reproducible captured-data checks from live browser observations. Run the automated suite, serve the actual single-file page, exercise its browser states, and reconcile CSV transaction rows against their summaries. Compare live figures only at the same transaction and price cutoff.

## Current implementation checks

- **38 Node checks plus 7 Python controls:** exact wei/ETH/cents, failed subset, UTC pricing, cache corruption, 10,100-row pagination, 10,001-row CSV, cancellation, resume, nonce gaps, receipt-source fallback and identity checks, unknown-fee exclusion, same-page immutable duplicates and concurrent provider ordering.
- **Ten controlled browser groups:** actual UI handlers with captured public transactions/receipts; multiple/deduplicated wallets, failures, empty wallet, missing prices, reload/resume, corruption recovery, cancellation, quota errors, CSV download/monthly chart, and all-RPC failure leaving a visible unverified hash. These controlled responses do not establish source uptime.
- **Independent CSV parsing:** Python csv/Decimal and independent downloaded-file review matched every transaction to its actual saved receipt. Exact fee, ETH decimal, USD cents, failed subset and monthly sums reconcile. Unknown fee/USD cells remain blank.
- **Atomic source refresh:** seven deliberate failure/atomicity controls demonstrate that failed or malformed historical-price refreshes exit nonzero and preserve the prior fixture. No live price refresh was needed to re-establish already valid historical evidence.
- **Static serving:** npm run dev tries another port when occupied. An actual run selected 4318 while preserving 4317; the temporary verification listener was stopped. The server serves only index.html and does not expose private notes or provide an API proxy.

## Stable public fixture

`fixtures/public-wallets.json` and the saved actual mainnet receipts establish a complete 34-transaction failed sender at indexed block 26302568:

| Measure | Exact captured value |
| --- | ---: |
| Sent / failed | 34 / 10 |
| Total wei | 96164252494628845 |
| Total ETH | 0.096164252494628845 |
| Failed wei | 39629962723545907 |
| Failed ETH | 0.039629962723545907 |
| Historical USD priced subtotal | 92.42 |
| Missing prices | 28 transactions on the current-day fixture date |

The empty fixture has no transactions and zero totals. The actual browser-downloaded combined fixture CSV contains 40 records: one metadata, 34 transactions, two wallet totals, two monthly totals and one total. Reconcile transaction records only; summary rows are deliberately repeated views.

## Real browser observations

The served local page successfully fetched Blockscout, Coinbase and dRPC through browser CORS. The final receipt-only live public failed+empty run at **2026-10-30 03:52:53 UTC**, indexed block **26303000**, returned:

- 36 sent, 10 failed, history complete, zero unverified receipts.
- Total 97880651001924672 wei; failed subset 39629962723545907 wei.
- USD 256.94, including 30 transactions priced by today's provisional candle; zero missing prices, two chart months and a generated CSV. This quote changes and is not a fixed expected target.

Two public transactions arrived after the 34-row capture, explaining its higher live count and ETH total. No values were tuned to a manual report. Earlier live USD observations were 255.17/255.58 as today's candle changed; those are prior observations, not current expected outputs.

A separate deliberately cancelled Vitalik smoke fetched two pages / 100 transactions, 6540155982668857 wei (0.006540155982668857 ETH), and stayed visibly partial. It does not establish a complete high-volume wallet total. Earlier diagnostic paging reached 2,100 rows before an HTTP500 and remains explicitly partial.

Keyboard validation/focus recovery and page containment passed at 320px; desktop containment passed at 1440px. The required minimalist-ui, frontend-design and design-taste-frontend direction was reviewed with critique/polish. The table/chart scroll inside their own regions. Exact monthly values are also available in a table; axis tick labels are a deferred visual refinement.

## Source coverage

Fourteen Coinbase windows yielded 3,815 daily prices, 2016-05-18 through 2026-10-29, with absent May 21/22, 2016. Vitalik's first sent day precedes that range and remains explicitly unpriced. See [API evidence](source-verification.md) and [actual receipt authority](source-receipts.md).

Public 2015 and five 2022 receipts, plus every receipt in the small fixture, were inspected. Sample agreement does not establish universal explorer-field semantics; the final app therefore uses actual receipts for all fees and never explorer gas figures.

## Reproduce and remaining limits

Node 22+ and Python 3 run `npm test`. `npm run dev` prints the selected localhost URL without installation/build. `python3 scripts/browser-check.py` uses an installed chrome-devtools-axi; `--port` selects the server port, `--plain` uses ASCII and `--details` shows diagnostics. The optional browser tool is not a product dependency.

Unverified: non-Chromium engines, physical phones, a real screen reader, exhaustive independent high-volume history, chain reorg recovery, every fallback provider's current browser availability, and the privately relayed wallet anomaly whose query was not approved. Public fixtures and synthetic counterexamples are tested; no private/report wallet literal or target figure enters committed tests.

No deployment was performed. Local stage commits and externally published sanitized history diverge; read the current [plan](../plans/wallet-gas.md) for exact delivery state. Automatic approval review rejected a local rebase and a private-wallet query because trusted live authorization was missing. Neither action ran, and no workaround bypassed either rejection.
