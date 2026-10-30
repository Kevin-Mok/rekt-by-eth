# Independent Ethereum receipt verification

This evidence compares Blockscout's receipt-derived transaction fields with real receipts from an independent keyless Ethereum mainnet RPC. Run the saved check without network access, or refresh only the RPC side against the same public transaction hashes.

## Verified source

The selected independent RPC is `https://eth.drpc.org`. It returned `eth_chainId = 0x1` and non-null `eth_getTransactionReceipt` results for all three sampled hashes on 2026-10-30. The request Origin was `http://127.0.0.1:4317`; successful responses included `access-control-allow-origin: *`. Actual browser access remains a separate Stage 3 check.

`fixtures/sources/restart-receipts.json` retains exact requests, response identity, gas, price, status, block, type, CORS headers, and projected Blockscout fields. Receipt logs and unrelated global transaction rows are omitted. The successful dynamic-fee sample reuses the existing `blockscout-page1.json` evidence; legacy and failed samples were selected from Blockscout's public validated-transactions endpoint.

| Sample | Type | Status | gasUsed | effectiveGasPrice (wei) | Exact fee (wei) |
| --- | --- | --- | ---: | ---: | ---: |
| `0x384554…f14a6` | EIP-1559 (2) | success | 46912 | 281329357 | 13197722795584 |
| `0xe02c40…277a6` | EIP-1559 (2) | failed | 188167 | 4432908115 | 834127021275205 |
| `0x2ea785…723d6` | legacy (0) | success | 34654 | 6150956180 | 213155235461720 |

For each sample, RPC `gasUsed`, `effectiveGasPrice`, status, sender and block match Blockscout `gas_used`, `gas_price`, `status`, sender and block. Integer multiplication equals Blockscout's `fee.value` exactly. This supports using the explorer's receipt-equivalent fields; it does not prove all future explorer rows or RPC uptime. Missing or malformed receipt-equivalent fields must still be an explicit incomplete result, never zero.

## Reproduce

Requirements: Python 3; curl only for `--live`. No keys, signing, or paid requests.

- `python3 scripts/verify-receipts.py`: verify captured evidence offline.
- `python3 scripts/verify-receipts.py --live`: re-request chain ID and the three pinned receipts, validate them, and update only the projected RPC evidence.
- `--plain`: ASCII labels. `--details`: raw diagnostics on an unsuccessful run. Each live request has a 30-second bound and emits progress.

The defining check was intentionally run before evidence was populated and rejected the absent chain record. Once public evidence was captured, all three comparisons passed; a separate mutation check confirms that changed prices and non-mainnet chain IDs are rejected.

## Workarounds and limitations

- PublicNode had previously failed curl TLS negotiation. LlamaRPC also returned curl 35 / OpenSSL wrong version number from this machine. Those transport errors do not establish a provider outage.
- Ankr's public endpoint returned JSON-RPC -32000 requiring an API key; it is unsuitable for this keyless run.
- dRPC served the requested real receipts and chain ID without authentication. No runtime dependency on these RPC probes is required; the site uses validated Blockscout equivalents and the RPC is an independent evidence check.
- The public failed sample sender is `0xECa713bb7483D1268e0147bF1803217E3ebD8170`; failed transaction nonce 2777. This is a public fixture, not a product default or a reference-report wallet. A complete address history has not been fetched by this receipt-only check.

## Small complete-history and empty public fixtures

`fixtures/public-wallets.json` pins a smaller public sender for routine Node/browser checks: `0x12d5a3b546F1033Da79C0bbb0F6dB2c6B230B9a8`. It was discovered in three additional global validated-transaction pages by selecting a failed transaction with low nonce, then its complete v2 sent history was requested. The API returned 34 unique sent transactions, contiguous nonces 0–33, and terminal `next_page_params: null` in one page. The first transaction is 2025-10-10T19:51:23Z and the fixture cutoff is block 26302568. That coverage lies within Coinbase's supported historical period; current-day prices remain provisional or missing under the app's stated policy.

The captured exact total is **96164252494628845 wei**, including **39629962723545907 wei** from **10 failed transactions**. Both a historical 2025 failure and the latest captured 2026 failure were independently checked with dRPC receipts; gasUsed, effectiveGasPrice and failed status match Blockscout. These are evidence expectations at the captured cutoff, not targets used to alter production data.

The valid address `0x7f320d5f214bc330213da459f91b20b42d6a501e` returned `items: []` and terminal null for sent history. It supplies the empty-wallet negative case. Both successful explorer responses included CORS `*` and exposed rate-limit headers. Full projected source data, timestamps, headers, exact requests and sampled receipts are in `fixtures/sources/restart-small-wallet.json`; unrelated transaction input/log fields are omitted. Later live activity may change results, so compare fixture totals at their recorded cutoff.

## Correction (2026-10-30)
The samples above matched on the sampled transactions, but a later full-wallet check found Blockscout rows with `gas_used` 0, max-fee `gas_price` and `ok` status for reverted transactions. The page now reads gas and status only from receipts.
