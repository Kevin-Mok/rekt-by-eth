# Ethereum mainnet receipt authority

Every fee in the site now comes from an actual JSON-RPC transaction receipt. Blockscout enumerates transaction identities and dates; the browser verifies mainnet and receipt identity, calculates exact wei, and lists any receipt it cannot obtain without guessing a fee.

## Runtime sources

The default order is `https://eth.drpc.org`, `https://ethereum-rpc.publicnode.com`, then `https://eth.llamarpc.com`. Each provider must return `eth_chainId = 0x1` before supplying fees. Requests are individual `eth_getTransactionReceipt` calls, never batches. Two receipt lookups run concurrently; calls are paced, cancellable, bounded by timeouts and finite retry counts. A null, malformed, wrong-chain or mismatched receipt advances to another provider.

Receipt transactionHash, sender and block must match the enumerated transaction. Receipt gasUsed and effectiveGasPrice are parsed as integers, including hex JSON-RPC quantities. Receipt status determines success/failure. The calculation is exactly `gasUsed × effectiveGasPrice` in BigInt wei. Explorer gas_used, gas_price, fee and advertised max fees never determine money.

If every source fails, the transaction remains an explicit unverified hash, excluded from known-fee totals. Enumeration continues. CSV includes its metadata with blank fee/USD cells and an unverified record type. Resume retries only missing receipts; already verified fees are restored from validated schema-2 snapshots. There is no approximate explorer fallback.

## Public evidence

- `fixtures/sources/restart-receipts.json`: independent mainnet chain and three legacy/dynamic/failed receipt comparisons. Saved check confirms gas, effective price, status, sender, block and exact fee.
- `fixtures/sources/historical-receipt-semantics.json`: a public 2015 receipt has status 0x1; five public 2022 EIP-1559 receipts match explorer fields. Four have max fees above effective price. These samples support their own comparisons, not a guarantee about every explorer row.
- `fixtures/sources/restart-small-receipts.json`: all 34 actual receipts for the public failed-wallet fixture, no differences from its saved source projection. Exact total 96164252494628845 wei; failed subset 39629962723545907 wei across 10 failures. Original fixture preserved.
- Actual browser CORS from the served local page passed for dRPC chain/receipt calls and the complete public failed+empty wallet calculation. PublicNode/Llama curl TLS failures are local transport observations; browser fallback availability is not guaranteed. Ankr required a key and is not used.

The original implementation used sampled receipt-equivalent explorer fields. Final delivery removes that assumption by fetching every receipt. Old schema-1 wallet snapshots cannot resume as verified results; calculate fresh. No private/report wallet is embedded in the product or public regression tests.

## Reproduce

Python 3 verifies the original independent samples with `python3 scripts/verify-receipts.py`; `--live` refreshes only those three RPC comparisons, `--plain` uses ASCII and `--details` reveals raw diagnostics on failure. Node fixture reports exercise the production receipt-only engine with all 34 saved receipts. The browser tests use recorded receipts for controlled failures and real public APIs in a separate live check.

Source availability, rate limits, indexing delay and chain reorganizations remain external risks. The page does not verify Merkle proofs or operate its own full node. Mainnet identity/receipt matching and exact arithmetic do not eliminate trust in public providers.
