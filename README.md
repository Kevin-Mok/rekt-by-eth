# Ethereum wallet gas spending

A small, read-only Ethereum mainnet gas audit site for people who want to understand what their wallets have paid to use the network. It combines exact receipt fees with historical daily ETH/USD prices, includes failed transactions, and makes incomplete data visible. Source verification and the calculation engine are implemented; the landing interface, CSV and chart follow in the remaining stages.

## Tech Stack And Why Chosen

- One vanilla HTML/CSS/JavaScript file: portable static hosting, no build, dependencies, wallet connection or secret.
- BigInt wei and fixed-point USD: exact fee arithmetic and consistent row-rounded totals across UI, CSV and chart.
- Built-in Node tests: exercise the same inline production logic without a parallel library.
- Python 3/curl source probes and JSON fixtures: reproducible, attributable public-data evidence without packages.

## Source evidence and current status

[Source verification](docs/source-verification.md), [independent receipt comparisons](docs/source-receipts.md) and the [active plan](plans/wallet-gas.md) explain the evidence and remaining stages. Blockscout enumerates sent transactions; its receipt-equivalent gas fields match three independent mainnet receipts. Coinbase Exchange supplies ETH-USD UTC daily closes: full-window verification found 3,815 daily prices from 2016-05-18 through 2026-10-29, with two absent early days. Earlier/gap transaction days stay explicitly missing. Browser CORS and product behavior are verified in later stages.

## Inspect and reproduce

Requirements: Python 3 and curl on PATH for source probes. No install or build step. `python3 scripts/verify-receipts.py` checks captured receipts offline; `--live` refreshes them. `python3 scripts/verify-price-history.py` refreshes full-window public Coinbase history. `python3 scripts/verify-wallet-history.py` follows the public diagnostic fixture history; a nonterminal cursor is partial, never a total. All support `--help` and `--plain` for ASCII labels. Old `probe-sources.py` preserves historical diagnostics; do not retry its obsolete price sources.

App usage and Node/browser/CSV commands will be documented as the corresponding stages land. No deployment is part of this task.

## Calculation and limits

Only unique canonical sent mainnet transactions count. Exact fee is receipt gasUsed × effectiveGasPrice in BigInt wei. Failed fees are already included in total and displayed separately as a subset. Incoming/internal/token transfer events and L2 fees are excluded. UTC daily Coinbase close at eight decimal places is converted to per-transaction USD cents, half up; totals sum row cents. Missing quotes never become zero and are never guessed. Daily estimates differ from execution-time quotes; explorer indexing and availability remain external dependencies.

## Future work

- CAD and other currencies via daily historical FX; USD is the only MVP currency.
- Optional additional independent transaction enumeration sources and price-provider failover. The current product pins Coinbase, with explicit gaps.

## Calculation engine verification

Node 22 or newer runs the production inline engine directly. `node --test tests/core.test.mjs` covers input validation, exact fees and USD rounding, failed/missing subsets, >10,000 synthetic transactions, persisted checkpoint resume, retries, cancellation and cache corruption. `node scripts/wallet-report.mjs --fixture small` replays the captured 34-transaction failed sender; `--fixture empty` shows zero behavior. `--plain` uses ASCII labels and `--help` prints usage. These fixture replays do not issue live requests or establish current explorer availability.

The engine validates complete history conservatively using sent nonce continuity. EIP-7702 authorizations can consume nonces without a sent transaction, so a nonce gap can produce an explicit incomplete warning even for a legitimately complete explorer response; the site must retain observed fee rows without certifying a full-wallet total.
