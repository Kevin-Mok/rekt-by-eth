# Wallet gas: design brief

Job: paste an Ethereum mainnet address, see how much gas it has spent (ETH, and USD at each tx day's UTC close).
Look: Hacker News / Craigslist plain. One column, max-width 640px, black on white, one accent (blue, links and focus only).

## Tokens
- Colors: bg #fff, ink #111, muted #595959, line #ddd, accent #1d4ed8, red #b3261e (failed gas, warnings, errors), pale #fdf0ef (warning background).
- Type: system sans for UI; system monospace for addresses. No web fonts.
- Scale: hero number 44-72px bold; USD 28px; headline 28-40px; body 16px; small 14px; chart/notes 12px.
- Spacing: 8px steps (8, 12, 16, 24, 32, 40, 72).

## Wireframe (390px and 1280px are the same column)
```
Wallet gas                         [About ≡]
------------------------------------------
     How much have you spent on gas?
[ 0xd8dA6BF2...96045 (placeholder)      ]
[            Show my gas                ]
  (inline error with the fix, if any)
  (progress text + Cancel while loading)
  (Partial history flag + Resume, only when unfinished)

           2.3854|34185640740061 ETH
               $8,723.70
     281 transactions, 14 failed (x ETH, $y)

By wallet table   (only for 2+ wallets)
By month chart, > Monthly values
> Details                     [Download CSV]
```

## Rules
- The result number is the only bold thing. Everything else is quiet.
- At most one line of secondary text on the main screen (the count/failed line).
  How it works, sources, exclusions and the USD caveat live in the header menu.
- Shown only when it applies: data-quality flag (partial history, unpriced days), errors with a fix, Resume.
- Banned: gradients, glass, soft card shadows, emoji icons, feature cards, stat badges,
  ALL-CAPS eyebrows, colored words in headlines, arrows on buttons.
- Copy: plain, no filler, no invented facts. Buttons say the action.
- Accessible: real labels (visually hidden where the placeholder shows the shape), visible focus ring,
  44px targets, AA contrast, prefers-reduced-motion respected, Escape closes the menu.

## Secondary text inventory
Before: 27 lines (eyebrow, lede, input label, explanatory placeholder, separator hint, privacy line,
"mainnet only" tag, results title, snapshot metadata, two metric labels, exact-wei line, USD detail,
"already included above", sources line, exclusions note, monthly title, monthly summary, chart legend,
chart note, method title, method paragraph, three method disclosures, footer caveat, "requests are read-only").
After: 1 line (count and failed subset). Chart legend and section labels stay as part of the chart.
