# Wallet gas: design brief

Job: paste an Ethereum mainnet address, see how much gas it has spent (ETH, and USD at each tx day's UTC close).
Look: Uniswap / dark bridge sites, kept minimal. One column, max-width 640px, dark by default, light via a header toggle.
One raised card holds the input and the button; everything else sits on the page background.

## Tokens (CSS custom properties per `data-theme` on <html>)
| token | dark (default) | light |
|---|---|---|
| --bg | #0d111c | #f5f6fa |
| --surface (card, menu) | #131a2a | #fff |
| --surface-2 (input, quiet buttons) | #1b2236 | #eef0f5 |
| --border (decorative) | #293249 | #e1e4ec |
| --field (input border, 3:1) | #5d6888 | #8b91a8 |
| --text | #f5f6fc | #0d111c |
| --muted | #9b9fb5 | #5e6275 |
| --accent / --accent-text | #d6006a / #fff | same |
| --danger / --danger-bg | #ff6b61 / #2a1a22 | #c4252b / #fdeeee |
| --bar / --grid (chart) | #7b86a6 / #293249 | #7c8399 / #e1e4ec |
- One accent (Uniswap-style pink, darkened from #FF007A so white text passes AA): primary button and focus only.
- Theme: saved in localStorage `wallet-gas-theme`, applied by an inline head script before first paint; nothing saved = dark (OS setting ignored). `color-scheme` set per theme.
- Type: Inter 4.1 variable (SIL OFL 1.1), Latin subset embedded as a woff2 data URI, weights 400-700. No monospace anywhere: addresses and numbers use tabular-nums. Fallback: ui-sans-serif, system-ui, Segoe UI Variable, SF Pro Display, Roboto.
- Scale: hero number 48-76px bold, ETH unit 22-32px muted, extra decimals on their own 15px line; USD 28px; headline 28-40px; body 16px; small 14px; chart/notes 12px.
- Shape: card radius 24px, input and primary button 16px, secondary buttons pill. 1px borders, no shadows.
- Spacing: 8px steps (8, 12, 16, 24, 32, 48, 64).

## Wireframe (390px and 1280px are the same column)
```
Wallet gas                  [sun] [About ≡]
------------------------------------------
     How much have you spent on gas?
[ 0xd8dA6BF2...96045 (placeholder)      ]
[            Show my gas                ]
  (inline error with the fix, if any)
  (progress text + Cancel while loading)
  (Partial history flag + Resume, only when unfinished)

              2.3854 ETH
            …34185640740061
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
- Banned: gradients, glass/blur, glows or soft card shadows, cards inside cards, emoji icons, feature cards, stat badges,
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
