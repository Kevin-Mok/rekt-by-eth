# Source-evidence smoke checks

These checks inspect the unfinished Stage 1 evidence without restarting failed acceptance attempts. They confirm what was captured, not application correctness; there is no website to test yet.

## Saved public probes

**Action:** Read fixtures/sources/blockscout-page1.json and blockscout-page2.json and docs/source-verification.md.

**Expected:** Two 50-row pages, no overlapping hashes, all from the required public wallet; both continuation cursors nonterminal. No complete-wallet or receipt-verified claim.

**Action:** Read fixtures/sources/cryptocompare-2015-cad.json, coingecko-2015.json, publicnode-chain.json and publicnode-receipt.json.

**Expected:** Price attempts show HTTP 401/key requirement and HTTP 401/365-day limit. RPC attempts show HTTP 000/curl35. Source gate is blocked; no fiat numbers or passing receipt checks.

## Protected handoff

**Action:** Read NIGHT_NOTE.md and the current review-notes.md before any resume. Confirm current time is before 2026-10-30T14:00:00Z and the branch is night/2026-10-29-wallet-gas.

**Expected:** Note remains excluded/untracked; builder never edits or commits review-notes.md. Two-failure stop remains in force until explicitly resolved. No stage resumes merely because the note was reread.
