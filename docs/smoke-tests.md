# Wallet gas smoke checks

Use the local static page to check arbitrary wallet input, exact fee totals, missing prices and resumable failures. Start the server, exercise the UI, then use the captured public fixture verifier when you need a stable comparison. Live wallets can gain transactions after the capture cutoff.

## Open and calculate

**Action:** Run `node scripts/serve.mjs` and open its printed local URL. If its preferred port is occupied, keep the existing listener running.

**Expected:** The server selects the next available port and prints it. The landing page explains ETH/daily USD gas spending and offers a centered address box. No build, install, wallet connection or network request occurs on page load. Private notes return404.

**Action:** Paste a valid public address, then two addresses separated by newlines; repeat one with different letter case. Submit. Try an ENS name and a short0x string as separate invalid submissions.

**Expected:** Valid wallets deduplicate by identity. Invalid input gets an accessible address error. Letter case is accepted without checksum verification. Results appear below input; only confirmed sent mainnet transactions count.

## Captured and live figures

**Action:** Use the public failed and empty addresses in fixtures/public-wallets.json. Compare a fixture replay with `node scripts/wallet-report.mjs --fixture small`; compare live figures only at matching cutoff.

**Expected:** Captured small history34sent/10failed,96164252494628845wei total and39629962723545907wei failed subset. Empty fixture is zero. Failed fees are already included once in total. Later live counts/fees can be higher and display a new indexed-block cutoff.

**Action:** Review USD for today's transactions and any dates before2016-05-18 or missing source buckets.

**Expected:** Today is provisional and never cached as final. Missing USD remains an incomplete priced subtotal, with transaction/day counts and affected dates. ETH remains exact. Price source names Coinbase Exchange UTC daily close.

## Persistence and recovery

**Action:** Cancel a multi-page calculation, reload and resume. Then disable/full browser storage or corrupt this app's stored JSON in devtools and recalculate.

**Expected:** Cancelled/interrupted history stays visibly partial. Validated pages resume without duplicate fees. Corrupt checkpoints require fresh calculation; corrupt price cache is ignored. Disabled/full storage keeps results in memory and warns that persistence is unavailable. Retry status and elapsed time remain visible during slow requests.

**Action:** Click Clear local data.

**Expected:** Only this app's price/snapshot keys are removed, inputs/results clear, and future calculations start fresh. No private keys or credentials are stored.

## Accessibility and narrow screens

**Action:** Use keyboard-only controls and a narrow320px viewport. Review validation, progress, Cancel, Resume, source links, wallet table and method details.

**Expected:** Visible focus, labelled input and announcements, no page-wide horizontal overflow. Wide table scrolls inside its labelled region. Exact ETH/wei values wrap or scale without loss. Reduced-motion preference is respected.
