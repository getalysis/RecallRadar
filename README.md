# RecallRadar — Free Recall Aggregator Website (Built for $0)

A static site that aggregates official US recall data from **CPSC** (consumer
products), **NHTSA** (vehicles), and **FDA/openFDA** (food, drugs, medical
devices) into one searchable feed, updated daily by a free automated job —
plus a live vehicle recall lookup tool. No backend server, no paid hosting,
no paid APIs.

## Why this idea, not another calculator site

Search "product recall checker" and you'll find only clunky individual
government sites and one dead cross-agency aggregator project — genuinely
low competition, unlike calculator/todo/converter tools. Recall lookups are
also **high-intent, self-motivated searches** (someone worried about a
specific product searches for it on their own), which means this can get
real organic traffic without you doing any outreach or marketing — you
asked specifically for that.

## What's already built and tested

- `scripts/fetch-recalls.js` — pulls live data from CPSC, NHTSA (via a
  make→model→recall lookup chain, since NHTSA has no firehose endpoint),
  and openFDA (food/drug/device), normalizes it, and writes
  `data/recalls.json` plus 5 RSS feeds. **Already run successfully** — it
  pulled 508 real, current recalls during testing.
- `index.html` — searchable, filterable recall feed (tested live: search
  and category-tab filtering both confirmed working against real data).
- `tools/vehicle-recall-lookup.html` — a live make/model/year lookup that
  queries NHTSA's API directly in the browser (tested live: correctly
  returned 5 real recalls for a 2020 Honda Accord).
- `.github/workflows/update-recalls.yml` — a free GitHub Actions cron job
  that re-runs the fetch script daily and commits the fresh data, so the
  site content updates itself with zero ongoing effort from you.
- `about.html`, `contact.html`, `privacy-policy.html` (AdSense-ready),
  `robots.txt`, `sitemap.xml`.

## Known limitation (documented honestly)

USDA/FSIS (meat, poultry, egg recalls) blocked automated requests from this
build environment (Akamai bot protection, returns "Access Denied" to
scripted requests regardless of user-agent). GitHub Actions runners have
different IPs and may not be blocked the same way — **first thing to try
after deploying**: manually trigger the Actions workflow once, then check
if adding an FSIS fetch function works from that environment. If FSIS stays
blocked everywhere, the current 3 sources (CPSC, NHTSA, FDA) still cover the
large majority of recall volume, including vehicles, all FDA-regulated food,
drugs, and devices, and all CPSC consumer products.

## Step 1 — Deploy for free (10 minutes, $0)

1. Create a free GitHub account if you don't have one, and a new **public**
   repo (must be public for GitHub Actions free minutes and GitHub Pages).
2. Push everything in this `recallradar/` folder to that repo.
3. Enable GitHub Pages: Settings → Pages → Source → `main` branch → Save.
   Site goes live at `https://<username>.github.io/<repo>/`.
4. Enable the cron job: go to the Actions tab, confirm workflows are
   enabled (public repos have them on by default), and manually run
   "Update recall data" once to verify it works end-to-end in GitHub's
   environment. It will then run automatically every day at 09:17 UTC.

(Cloudflare Pages works too if you prefer — same free-forever deal — but
GitHub Pages is simpler here since the data-refresh job already lives in
GitHub Actions and needs to commit back to the same repo.)

## Step 2 — Fix the placeholder domain

Every file references `https://recallradar.example.com/`. After deploying,
find-and-replace that with your real URL
(`https://yourname.github.io/recallradar`) across all `.html`/`.xml`/`.txt`
files, and in `scripts/fetch-recalls.js` (the `SITE_URL` constant, used in
RSS feed generation).

## Step 3 — Monetize

Same playbook as any content site:

- **Google AdSense** (free, ~1-2 week approval): sign up at
  adssettings.google.com... sorry, adsense.google.com, submit your deployed
  URL. This site already has the privacy policy, about, and contact pages
  AdSense requires. Paste your ad snippet into the `ADSENSE_HEAD_SLOT`
  comments and swap the `.ad-slot` divs for real ad units.
- **Premium tier idea** (fast-follow, not built yet): once you have
  Cloudflare account access, add a Cloudflare Worker + D1 database to let
  users save specific brands/VINs and get instant email alerts (via Resend's
  free tier, 3,000 emails/mo) instead of relying on RSS. This is the kind of
  feature people would pay $3-5/mo for — the free RSS feeds already in this
  build cover the free tier.

## Step 4 — Get indexed

Same as any site: free Google Search Console account, add your URL, submit
`sitemap.xml`. Recall content is inherently newsworthy — individual recall
pages/news-cycle spikes (a big-brand recall going viral) can drive real
traffic spikes for free, which a static calculator site never gets.

## File structure

```
recallradar/
  index.html
  about.html
  contact.html
  privacy-policy.html
  robots.txt
  sitemap.xml
  style.css
  scripts/
    fetch-recalls.js
  data/
    recalls.json          (generated — 508 real recalls as of last test run)
    rss-all.xml
    rss-consumer-products.xml
    rss-vehicles.xml
    rss-food.xml
    rss-drugs.xml
  tools/
    vehicle-recall-lookup.html
  .github/workflows/
    update-recalls.yml
```

## Realistic timeline

Same honest caveat as any organic-traffic play: expect near-zero traffic in
month 1 while Google indexes the site, then growth as search rankings build
and any recall-related news cycles send free spikes of traffic your way.
Recall content's self-motivated search intent generally converts to ad
revenue better than generic utility tools, but it's still a multi-month
build, not instant.
