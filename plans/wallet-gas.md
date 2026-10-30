# Wallet gas website: USD-only restart

Build a self-contained read-only Ethereum mainnet gas audit page. Verify sources, implement exact calculations, add the minimalist interface, reconcile exports and charts, then review the completed artifact. This plan follows Kevin's direct 2026-10-30 RESTART instruction, which supersedes the original prompt wherever they conflict.

## Authority and scope
- Branch only: `night/2026-10-29-wallet-gas`; no deployment, main push, force-push or PR.
- USD only. Other currencies via daily FX are future work. Original two-wallet/report checks dropped by Kevin; no tuned target figures.
- Prior two-failure counter reset to zero; no stop-on-two-failures rule remains. Switch alternatives, record gaps and continue to a working page. Deadline 2026-10-30T14:00:00Z.
- Existing Blockscout two-page evidence reused. Sent canonical mainnet transactions only; self-transfers once; failed gas included and shown as subset. BigInt receipt-equivalent gasUsed × effectiveGasPrice in wei.
- One inline CSS/JS `index.html`, no dependencies, keys, signing, CDN or build step. Supporting Node tests, public fixtures and scripts allowed. No public wallet literals in index.html.
- Private NIGHT_NOTE/review-notes and local run/goal/task/night files never staged or pushed. Existing unrelated files preserved. Commit related plan/docs with each implementation stage; after each commit scan tracked files and push only the approved branch if safe.

## Decisions and interfaces
- Pin Coinbase ETH-USD UTC daily candle close after full-window verification. Request <300-day windows, filter extraneous buckets. Eight decimal USD price scale, per-transaction cents rounded half up using integers; sum cents for all views. Today is provisional and not cached. Missing dates never guessed or valued as zero.
- Address policy: 20-byte 0x hex, case-insensitive identity; mixed-case checksum is not checked and UI explains this. Split commas/semicolons/whitespace, deduplicate.
- Core lives in a dedicated inline script block exposed as `Gas` for Node vm tests; UI code in a second inline block. No parallel production library that can drift.
- `parseAddresses`, `normalizeTransaction`, `formatEth`, `priceToUnits`, `valueRows`, `summarize`, `fetchWallet`, `loadPrices`, `exportCsv`, `monthlyTotals`: tested production functions. Public data validated on every boundary.
- Capture as-of UTC and indexed block before fetching, use one cutoff for all wallets. Persist versioned validated wallet pages + cursor + rows + cutoff locally atomically; resume that snapshot explicitly, refresh starts a new cutoff. Finite retries, timeout, cancellation, progress; respect rate headers where exposed and safe pacing otherwise. Never silently truncate >10k histories. Repeated cursors fail visibly.
- Price cache versioned by source/day, timestamp/provenance checked; ignore corrupted data, tolerate disabled/full storage. A clear-local-data action removes only this app's keys. Public addresses/history stay on device but are sent to explorer and dates to Coinbase; no telemetry.
- Partial ETH and USD states remain explicit; missing receipts are errors, missing daily prices yield an incomplete priced subtotal. Export includes metadata, exact wei, ETH, per-row USD cents, missing prices, failed subset and reconciliation summary.

## Stage gates and evidence
- [x] 1. Source verification (`feat: verify keyless mainnet data sources`): full-window Coinbase history including oldest public fixture days; independent mainnet sampled legacy/EIP1559/failed receipts; public failed and empty fixture; preserve paging evidence. Curl evidence now, browser CORS verified in Stage 3. Source limitations documented.
- [x] 2. Logic (`feat: calculate exact wallet gas and historical USD`): defining Node tests observed RED then GREEN; BigInt fee/status/sender validation, exact rounding, UTC boundaries, empty wallet, duplicate hashes/addresses, >10k synthetic paging, retry/cancel/resume, validated cache and missing prices. Real public fixture smoke.
- [x] 3. UI (`feat: add minimalist wallet gas landing page`): system fonts, concept + centered wallet box, responsive accessible results below, totals/failed line/table; real browser requests and empty/failed/multiple fixtures; progress/cancel/resume/storage/error states. Skills in required order: minimalist-ui, frontend-design, design-taste-frontend, polish/critique.
- [x] 4. CSV/chart (`feat: export reconciled gas data and monthly chart`): test-first CSV parsing/reconciliation exact wei/ETH/cents including failed subset, monthly totals equal summary; accessible monthly USD chart; browser download and missing-data coverage.
- [ ] 5. Final (`docs: verify and deliver wallet gas website`): fresh full Node + browser + CSV checks, review, secret scan, README APIs/limits/precision/cache instructions, smoke checks, final note and branch push verification. No deployment.

## Risks and review focus
- Explorer is sole transaction enumeration source; independently sampled receipt verification establishes field semantics, not exhaustive independent history. Reorg/indexing lag remains a disclosed risk.
- Coinbase starts May 2016. Earlier/gap days explicitly missing; do not claim all historical USD totals are complete. Daily close differs from execution-time prices.
- Blockscout may not expose rate headers through CORS; use conservative pacing + Retry-After where visible, retain atomic checkpoints through quota/offline/cancel.
- Test lost-response/repeated cursor/duplicate boundary pages, corrupted persisted rows and prices, malformed receipt fields, mixed wallets with missing days, CSV partial/missing semantics.
- Public push requires scan of tracked content and history; never publish private helper artifacts. Any blocked push is recorded without stopping implementation.

## Milestones
- Earlier local checkpoints b4986b2 and 1f88f14 preserved blocked-source evidence. They are not passing stages.
- Restart: branch/status reviewed, note appended, live overrides applied. Source checks in progress. No completed product stage yet.

Stage 1 milestone: Coinbase14windows/3815days, explicit pre-May2016 and two internal gaps; dRPC chain1/legacy/dynamic/failed matches; complete small wallet34sent/10failed and empty fixture; existing two paging captures reused. Browser CORS and >10k synthetic continuation belong to following stages.

Stage 2 milestone (`feat: calculate exact wallet gas and historical USD`):20production-core Node tests, observed RED/GREEN for core and review corrections. Captured small/empty CLI replay agrees exact wei and failed subset; missing today price explicit. Independent review fixed atomic partial retention, persisted completeness, immutable duplicates and gap-resolution metadata. EIP7702 conservative warning documented. Stage3UI/CORS and Stage4exports/chart remain. Push gate unchanged: inherited private harness files.

Stage3 milestone (`feat: add minimalist wallet gas landing page`):21Node/server checks;8controlled browser groups including review regressions; actual Blockscout/Coinbase/dRPC CORS, live failed+empty and deliberately cancelled2-pageVitalik. Keyboard320px and desktop1440px containment checked. npmdev occupied4317 selected4318 without stopping listener. Required design skills and critique/polish applied; reviewer correction4verified/0incorrect. Private helper publication gate still blocks push. Next:Stage4CSV/monthlychart; other browsers/devices/screenreader unverified.

Stage4 milestone (`feat: export reconciled gas data and monthly chart`):27Node tests pass, including10001CSVrows; independentPython CSV/Decimal and actualbrowser-downloaded40-record combined fixture reconcile exactwei/ETH/cents/failed/monthly (34transactionrows,28missing). Browser9groups pass. Focused review7verified/0incorrect; optionalaxis-tick refinement deferred (table/tooltips exact). Publication remains local: automaticapproval rejected rebase, directasyncapproval pending; no bypass. Next: finalaudit/freshchecks/hand-off.

## Future ideas (not tonight's scope)
- Gas leaderboard with shortened addresses (`0x1234…abcd`). A wallet is listed only after its owner connects MetaMask or Rabby and proves ownership.
  - Proof of ownership: a sign-in-with-Ethereum style message with a nonce. It costs no gas and sends no transaction; the server checks the recovered address. Never ask for a transaction or token approval.
  - Needs a small backend (a Vercel function plus a small database) to store entries and verify signatures, which ends the "static page, nothing stored" design, so it is a deliberate separate stage.
  - Privacy: opt-in only, with a way to leave the board or show a label instead of the address.
  - Integrity: the board uses the same receipts-only totals as the main page, recomputed on the server, never numbers sent by the browser.
  - Open question: rank by total ETH, by USD, or by failed-transaction gas.
- Other currencies via daily FX rates; ENS name input.

## Final correctness revision: receipt authority

Source-field equivalence was verified on samples, not guaranteed for every explorer row. To satisfy the direct receipt-fee contract without that assumption, final delivery will fetch an actual mainnet RPC receipt for every enumerated transaction. Blockscout supplies identity/order/time only; its gas_used/gas_price/fee never determine money. Public historical2015/2022 and all34 smallwallet receipts agree with previous public fixtures; the privately relayed anomaly remains unqueried pending direct authorization. No reference-count gate is reinstated.

- [x] Defining RED/GREEN for explorer gas_used0/maxfee versus actual receipt, null/invalid first RPC→nextRPC, chain/hash/block/status validation, allRPCfailure explicit unverified exclusion, resume retries unresolved only.
- [x] Bounded per-call receipt lookup (no RPC batch), chain1 pinning, cancellation/retry/progress, schema2 checkpoints reject old explorer-based snapshots.
- [x] UI/CSV/chart distinguish missing receipts from missing daily USD; unverified hashes remain visible and excluded from known-fee totals. No approximate explorer fallback or guessed fee.
- [x] Re-run publicfixture live/browser/CSV and fulltests; update source/privacy/retention docs. No privatewalletqueries without approval.
- [x] Fix historicalsource refresher falsePASS/partialoverwrite with seven defining failure/atomicity tests; preserve existing3815pricefixture.

Receipt-authority correction milestone (`fix: verify every gas fee from mainnet receipts`):38Node checks plus7Python controls,10controlled browser groups, actualpublic36-sent/10-failed run withzero unverifiedreceipts. Independentreview7verified/0incorrect, deliveryonlyunresolved. All34capturedactualreceiptsmatch priorpublicfixture; sourcepricefixtureunchanged. Fixedsamepage immutableduplicates and concurrentRPC fallback ordering with observedRED/GREEN. Unknownfees staylisted/excluded and do notstop paging. No privatequery or originalreporttarget. Readme/source/smoke docs updated in matchingchange.
