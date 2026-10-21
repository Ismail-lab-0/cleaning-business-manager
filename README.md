# Cleaning Business Manager

A browser-based app for self-employed house cleaners and small maid services: clients, repeating jobs, quotes, invoices, payments and expenses in one place. Data stays on your own device.

**Try the free demo:** https://Ismail-lab-0.github.io/cleaning-business-manager/ (feature-limited preview)

## Features

- Clients entered once, reused on jobs, quotes and invoices
- Repeating jobs that create the next visits
- Price calculator from your own hourly rate
- Invoices with payments, overdue flags and print/CSV
- Income, expenses and profit by month
- Offline-capable, JSON backup and restore, no account

## Setup

This is a static, self-contained HTML app — no build step required to run it.
Open `index.html` directly, or serve the repo's `docs/` folder (this is what
GitHub Pages does automatically for this repo).

## Limitations

- Data is stored locally in the browser only — export a backup periodically.

## Deployment

Published via GitHub Pages from the `docs/` folder on `main`. The demo build (if any) and the full build are generated from the same source by `tools/app_bundle.js` — see that script for the `--demo` flag.
## Notes

The free demo limits clients and CSV import. That limit is enforced in the browser, so it is a nudge, not copy protection.
