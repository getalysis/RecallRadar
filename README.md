# RecallRadar

RecallRadar aggregates official U.S. recall data — consumer products (CPSC),
vehicles (NHTSA), and food/drugs/medical devices (FDA, via openFDA) — into a
single searchable feed, updated daily. It includes a live vehicle recall
lookup by make, model, and year.

**Live site:** https://getalysis.github.io/RecallRadar/

## Why

Checking whether a product, vehicle, food item, or medication has been
recalled normally means visiting three or four separate government sites,
each with its own search interface. RecallRadar pulls fresh data from each
agency's official public API and presents it in one place — searchable by
keyword or brand, with per-category RSS feeds for anyone who wants ongoing
alerts.

## How it works

- `scripts/fetch-recalls.js` pulls recall data from the CPSC, NHTSA, and
  openFDA public APIs, normalizes it into a common schema, and writes
  `data/recalls.json` plus five RSS feeds (all recalls, and one per
  category).
- `.github/workflows/update-recalls.yml` runs that script once a day via
  GitHub Actions, commits any changes, and lets GitHub Pages redeploy
  automatically.
- `index.html` is a static, client-side search and filter interface over
  the generated JSON — no backend required.
- `tools/vehicle-recall-lookup.html` queries NHTSA's API directly from the
  browser for a live, real-time lookup by make/model/year, independent of
  the daily-refreshed dataset.

## Data sources

| Agency | Coverage | API |
|---|---|---|
| CPSC | Consumer products | SaferProducts.gov REST API |
| NHTSA | Vehicles | `api.nhtsa.gov/recalls` (queried per make/model/year via the vPIC vehicle catalog) |
| FDA | Food, drugs, medical devices | openFDA `/food`, `/drug`, `/device` enforcement endpoints |

USDA/FSIS (meat, poultry, and egg product recalls) is not currently
integrated — its public endpoint blocks automated requests from some
network origins. This is a candidate for a future addition if it proves
reachable from GitHub Actions' runners.

## Local development

```
node scripts/fetch-recalls.js   # regenerates data/recalls.json and the RSS feeds
python -m http.server 8000      # serve the static site locally
```

## Architecture notes

- Fully static — no server, no database, no paid infrastructure.
- Data refresh is entirely handled by the scheduled GitHub Actions workflow;
  no manual maintenance is required for the site to stay current.
- Monetization is ad-supported (Google AdSense placement points are marked
  in the HTML) with a per-category RSS layer as the free alerting mechanism.

## License / attribution

Recall data is sourced directly and unmodified from official U.S.
government APIs (CPSC, NHTSA, FDA). RecallRadar is an independent project
and is not affiliated with, endorsed by, or operated by any government
agency.
