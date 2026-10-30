# Sanitized publication notes

This branch is a sanitized snapshot of local commit 7392ee7 ("feat: calculate exact wallet gas and historical USD").

## Placeholders

None. No file in the published tree needed a placeholder value: the app and scripts use only keyless public data sources, and the privacy gate and `scripts/secret-scan.py` found no credentials, emails, or home paths.

## Not published (git-ignored, local only)

| Path | Reason |
|---|---|
| `.harness/` | Private build-session helper notes |
| `prompts/` | Internal task prompt and run instructions |
| `docs/postmortem/` | Internal run notes |
| `NIGHT_NOTE.md`, `review-notes.md` | Private run/review notes |
| `*.log`, `run*.sh`, `goal*.txt`, `night-*.txt`, `edit.txt` | Run logs and run scripts |
| `fixtures/reference-wallets.json` | Removed: dropped scope (private reference-wallet check) |

## Manual setup

Nothing to enter. Run tests with `node --test tests/core.test.mjs`.
