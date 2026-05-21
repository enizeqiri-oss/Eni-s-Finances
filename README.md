# Atelier — Personal Finance App

A calm, editorial finance dashboard. Built in the Atelier design language
(cream surfaces, Newsreader serif with italic terracotta accents,
JetBrains Mono micro-labels). All Swiss conventions — CHF, apostrophe
thousand-separators, Säule 3a, BVG.

No build, no dependencies. Pure HTML, CSS and one tiny JS layer.
Your data lives in your browser only (`localStorage`).

## Getting started

1. Open **`onboarding.html`** in a browser.
2. Six short steps: name and kanton → main employment → side income →
   tax/3a/BVG → fixed bills → variable budgets and optional net worth.
3. Either fill in your own numbers or click **"load the demo with
   Lena's data"** to see a fully populated dashboard.
4. After onboarding you land on the Overview. The sidebar takes you to
   Income, Bills, Upload and Summary; "Mobile preview" shows the iPhone
   companion; "Reset all data" clears everything and restarts onboarding.

If you open `index.html` (or any dashboard page) before onboarding,
you'll be redirected to `onboarding.html` automatically.

## Screens

| File | What it does |
| --- | --- |
| `onboarding.html` | 6-step wizard, persists to localStorage |
| `index.html` | Overview — net worth, portfolio, cash flow, upcoming bills, spending donut, recent activity. **Add transaction** writes to state. |
| `income.html` | Live Brutto → Netto card. Every input updates the dashboard instantly. |
| `bills.html` | Edit bills: add new, toggle paid/upcoming, remove. Filter by category. |
| `upload.html` | OCR demo. **Confirm & file** adds the Migros receipt as a real transaction. |
| `summary.html` | Saved/in/out/rate hero, category breakdown (recomputed from your data), insights that adapt to your budgets. |
| `summary-print.html` | Print-ready A4 of the monthly statement (`@page A4`). |
| `mobile.html` | iOS companion (390 × 844) — net worth, In/Out, up-next, top-3 buckets. |

## State & files

- **`assets/atelier.css`** — design tokens + components (sidebar, topbar, cards, hero, charts, tables, chips, pills, insights, dropzone, dark calc card)
- **`assets/state.js`** — single state store backed by `localStorage`, derived calculations, Swiss number formatter
- **`assets/app.js`** — page bootstrap, `data-bind` rendering, page-specific behaviors and the onboarding wizard

To reset everything: in the sidebar of any page click **"Reset all data"**.
