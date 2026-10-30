# Wallet gas website: USD-only restart

Build a self-contained, read-only Ethereum mainnet gas audit page. Verify the sources and exact calculation, add the minimalist interface and reconciled exports, then record fresh verification and delivery status. The owner's direct RESTART instruction overrides the original prompt and conflicting review notes.

## Scope and decisions

- Work only on `night/2026-10-29-wallet-gas`. No deployment, main push, PR or force-push. Preserve existing work and exclude private run/review artifacts.
- USD only. CAD/other currencies via historical daily FX are future work. The original two-wallet/report check was dropped, not failed or pending. Never tune data to a target.
- The earlier failure counter reset to zero on restart; no two-failure stop rule remains. Try alternatives, record workarounds and keep building. Deadline: 2026-10-30T14:00:00Z.
- One index.html with inline CSS/JavaScript, system fonts and no build/CDN/backend/keys/signing. Supporting tests, public evidence and local verification scripts are allowed.
- Accept full 0x/40-hex addresses, normalize identity and deduplicate comma/space/semicolon/newline lists. Mixed-case checksum is not verified; ENS is rejected. An empty wallet shows zeros.
- Count unique confirmed canonical sent transactions only. Exclude incoming/internal/event duplication and L2 fees; self-transfers count once. Failed fees are included once and also shown as a subset.

## Data authority and precision

Blockscout enumerates identities, sender, nonce, indexed block and UTC time. **Every fee and failure status comes from an actual mainnet RPC receipt**, never explorer gas/price/fee fields or advertised max fee. dRPC is primary, then PublicNode/LlamaRPC. Verify chain ID 1, hash, sender and block; parse decimal/hex quantities and compute BigInt gasUsed × effectiveGasPrice in wei. Two individual lookups run concurrently; no RPC batches.

If all receipt providers fail, preserve the unverified hash/reason and exclude its unknown fee. Continue enumeration. Resume retries missing receipts without refetching completed history. A failed receipt has a finite provider budget once per calculation; later pages do not multiply it. No approximate explorer fallback is used.

Coinbase Exchange ETH-USD UTC daily close is pinned. Request windows shorter than 300 days, filter overlapping/out-of-window buckets, and use eight-decimal fixed-point prices. Round each transaction to cents, half up, then sum those cents for page/CSV/monthly views. Missing prices stay blank and produce incomplete priced subtotals. Today is provisional and never cached as final. Verified coverage starts 2016-05-18 with two early gaps; older days are never guessed.

Capture one as-of UTC/indexed-block cutoff for every wallet in a snapshot. Follow cursors until terminal; detect repeated cursors, immutable-data conflicts and nonce gaps. Nonce gaps can also reflect EIP-7702 authorization, so conservatively flag history rather than assert a definite cap. No arbitrary 10,000-row limit.

Persist versioned validated price data and schema-2 receipt checkpoints atomically. Reject old explorer-based fee snapshots and inconsistent proof/metadata. Corrupt/disabled/full storage cannot destroy in-memory results. Clear-local-data removes only this app's keys. Requests remain paced, cancellable and visible through progress/elapsed time; available rate/reset/Retry-After headers inform finite retries.

## Interfaces and user states

The shipped `Gas` inline module is exercised directly by Node, not duplicated in a library. Core interfaces are normalizeTransaction with receipt verification, createReceiptClient, fetchWallet, loadPrices, summarize, monthlyTotals and exportCsv. Separate inline UI/export blocks render safe text and validated links.

The landing page explains the concept and centers one wallet box; results follow below. Show ETH/wei, daily USD, failed subset, wallet table, monthly chart and CSV. Distinguish partial history, missing receipts, missing USD and provisional prices. Unknown hashes and missing days remain inspectable. CSV transaction/wallet/monthly/total views reconcile exact amounts; unverified rows have blank money and source/status flags. Failed chart bars remain inside totals, with an exact monthly table alternative.

Required design order applied: minimalist-ui → frontend-design → design-taste-frontend → critique/polish. Warm restrained styling, system fonts, visible keyboard focus and contained narrow-screen table/chart scrolling.

## Stage gates

- [x] 1. Sources: reused original paging evidence; verified all available historical price windows, first public dates, mainnet receipts and failed/empty fixtures. Browser CORS subsequently confirmed.
- [x] 2. Logic: observed defining RED/GREEN for exact fees/rounding, failed/missing subsets, UTC dates, address/hash deduplication, >10k paging, cancellation/retry/resume and corrupt storage.
- [x] 3. UI: actual public failed+empty calculation, deliberately cancelled high-volume smoke, accessible recovery states, keyboard and narrow/desktop containment.
- [x] 4. CSV/chart: exact row/total/failed/monthly reconciliation, missing values and actual browser download; 10,001-row export covered.
- [x] Receipt authority correction: all fees use actual receipts; schema-2 migration, wrong-chain/identity rejection, fallback, unresolved continuation, duplicate metadata and concurrent provider ordering have defining regressions.
- [x] Source-refresh correction: seven RED→GREEN controls prevent false success or partial overwrite of historical evidence; prior fixture is preserved until full validated refresh succeeds.
- [ ] 5. Final delivery: local checks/review/docs complete; publication remains blocked pending trusted integration authorization and a clean candidate scan.

## Milestones and evidence

| Milestone | Local commit | Result |
| --- | --- | --- |
| Sources | c18ff15 | Historical windows, receipt samples, explicit gaps and complete public fixtures |
| Initial engine | 7392ee7 | Exact math, paging/resume/cache and defining tests |
| Landing UI | 19ff039 | Actual browser CORS, public wallets and recovery checks |
| CSV/monthly chart | 598d0d7 | Independent downloaded-file/parser reconciliation |
| Receipt authority | 4bd685b | Actual receipts for every fee; source-refresh integrity; full regression suite |
| Final handoff | docs: verify wallet gas site and delivery status | Current evidence, delivery gap and morning handoff |

Fresh verification: **38 Node checks, 7 Python controls, 10 controlled browser groups**. All 34 captured public receipts independently match the fixture; CSV exact wei/ETH/cents, failed subset and monthly sums reconcile. Actual public live run at 04:11:09 UTC, block 26303091: 36 sent/10 failed, total 97880651001924672 wei, failed 39629962723545907 wei, zero unverified receipts, USD 256.95 with 30 provisional transactions. Mobile 390×844 had no page overflow; earlier 320px keyboard and 1440px desktop checks passed. All fixtures are below 3 MB. See [verification](../docs/verification.md), [sources](../docs/source-verification.md) and [smoke checks](../docs/smoke-tests.md).

Independent final correction review: 7 verified, 0 incorrect, 1 unresolved (delivery). Content secret-pattern scan has zero matches; it is not exhaustive secret detection. The publication guard still flags three inherited private helper paths.

## Delivery blocker and next action

The last read-only fetch observed externally published night branch **b908654**, with a different UI/receipt implementation. It is not the same tree as local 4bd685b; preserve that work. Earlier local history contains excluded helpers. Automatic approval review rejected a backed-up rebase because authorization came only from review notes; direct trusted approval is pending. No rewrite, force-push or private-wallet query ran. No builder push/deployment is claimed.

After trusted approval, back up private/local work, integrate the authorized core/tests/docs onto the **current** sanitized night history while preserving external UI, rerun appropriate checks and candidate privacy scans, then push normally to that branch only. Otherwise retain verified local commits and disclose the gap. Never bypass the rejection or publish the old private history. The separate private-wallet query is optional diagnosis, not a reinstated reference gate.

## Risks and review notes

Public providers remain trusted dependencies; the page does not verify Merkle proofs or run a node. Index lag/reorgs, every fallback origin's availability and exhaustive independent high-volume history remain unverified. Non-Chromium engines, physical phones and a real screen reader were not tested. The privately relayed wallet anomaly was not queried and is not claimed fixed; generic counterexamples and public receipts are tested. Axis tick labels are an optional visual refinement; exact monthly values/tooltips exist. A fresh calculation or Clear local data safely abandons an old snapshot; future code rollback should use a new commit from a verified baseline, not history rewriting.

## Future ideas (not tonight's scope)
- Gas leaderboard with shortened addresses (`0x1234…abcd`). A wallet is listed only after its owner connects MetaMask or Rabby and proves ownership.
  - Proof of ownership: a sign-in-with-Ethereum style message with a nonce. It costs no gas and sends no transaction; the server checks the recovered address. Never ask for a transaction or token approval.
  - Needs a small backend (a Vercel function plus a small database) to store entries and verify signatures, which ends the "static page, nothing stored" design, so it is a deliberate separate stage.
  - Privacy: opt-in only, with a way to leave the board or show a label instead of the address.
  - Integrity: the board uses the same receipts-only totals as the main page, recomputed on the server, never numbers sent by the browser.
  - Open question: rank by total ETH, by USD, or by failed-transaction gas.
- Other currencies via daily FX rates; ENS name input.

