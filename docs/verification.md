# Wallet gas verification

This record separates stable captured-data checks from live browser observations. Re-run the automated suite and browser scripts against a local server, then compare figures only at the same transaction cutoff and price snapshot.

## Source and calculation evidence

- Stage1c18ff15: Coinbase14boundedwindows/3815dailycloses through2026-10-29; earliest2016-05-18 with explicit May21/22gaps. Vitalik firstsent2015-10-01 predates source and stays unpriced. Small complete failed and empty public fixtures captured.
- Stage2 7392ee7:20Node tests passed after deliberate RED/GREEN. Exact captured small wallet34sent/10failed;96164252494628845totalwei/39629962723545907failedwei. Historical replay has28current-day unpriced rows and92.42USD priced subtotal; emptywalletzero.
- Independent receipt check: dRPC chain1, real legacy/dynamic/failed receipt fields and exact fees match Blockscout. Actual browser POST from localpage returnedHTTP200/non-null receipt for captured dynamic hash.

## Browser observations: 2026-10-30

- Actual Chrome from host-local page successfully fetched Blockscout and Coinbase with browser CORS. At02:52:30UTC, indexedcutoff26302699, the smallwallet had36sent/10failed,97880651001924672totalwei and39629962723545907failedwei. Two transactions arrived since the captured34-row fixture; no tuning or filter to match the earlier count. ObservedUSD255.17 included today's changing candle and is not a fixed expected value.
- The emptywallet returned0sent/0ETH/0USD within the combined request.
- Deliberately cancelled Vitalik smoke: cutoff26302725,2pages/100rows,6540155982668857wei =0.006540155982668857ETH, completefalse. UI explicitly partial; prices not loaded because cancellation occurred first. This is not an exhaustive Vitalik total.
- Controlled browser fixture tests exercise actual UI handlers with synthetic HTTP responses from captured evidence: multiple/deduplicated wallets, failed subset, exact totals, missing prices, emptywallet, malformedcache, reload/resume with no history refetch, cancellation, corruptsnapshot recovery, clear-localdata and quotaerrors retaining memory. They do not establish source uptime.
- Keyboard submission and accessible error/focus states passed at320px. Desktop1440px and narrow320px page containment passed; table uses its own horizontal scroll region. Warm monochrome/centered-input direction reviewed with minimalist-ui, frontend-design, design-taste-frontend and critique/polish. No blocking visual issue; functional helpers enlarged for mobile readability.
- `npm run dev -- --plain` while preferred4317occupied selected4318 without disturbing4317. The temporary verification server on4318 was stopped; the main owned preview stays on4317.

## Reproduce and limitations

Node22+ and Python3 are enough for app/server/unit checks. `npm test` uses built-in Node tests, no installation. `npm run dev` serves onlyindex.html and tries another port automatically. `python3 scripts/browser-check.py` runs controlled states through an installed `chrome-devtools-axi`; `--port` chooses the printed port, `--plain` usesASCII, `--details` shows diagnostics. Browser CLI installation is optional developer tooling, never a site dependency.

`tests/browser-ui.js` and `tests/browser-accessibility.js` can be sent to the installed Chrome CLI with its stdin run command. Live source tests use the real page separately. No real wallet connection/signature/transaction, paid API, Etherscan automation or deployment.

Unverified: non-Chromium engines, physical mobile devices and a real screen reader; exhaustive independent high-volume history/reorg behavior. Node covers10100synthetic sent transactions; that is algorithmic continuation evidence, not an exhaustive production-wallet audit. Blockscout is the sole enumerator; noncegaps (including legitimate EIP7702authorizations) conservatively prevent full certification. Price/provider availability can change.

## Delivery status

