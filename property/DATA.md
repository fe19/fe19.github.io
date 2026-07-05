# Swiss Property Statistics — data notes

## What the app shows

`property.html` is a fully static tool (it runs entirely on GitHub Pages, no backend).
It shows statistics for **properties to buy** (apartments and houses, no rentals) per
canton and city:

- median asking price in CHF per m²
- number of active buy listings
- median asking price per property
- year-over-year price change

## Where the data comes from

A purely static site cannot query ImmoScout24, Comparis, newhome or Homegate live:
none of them offers a free public API, their pages block cross-origin/bot requests,
and scraping violates their terms of service. Official open data (the BFS Swiss
Residential Property Price Index, IMPI) is freely available but only publishes an
*index* for Switzerland and five municipality types — no CHF/m² per canton or city.

The app therefore ships a **bundled snapshot dataset** (`data.js`) compiled by hand
from publicly published market statistics, primarily:

- Swiss Federal Statistical Office (BFS), Residential Property Price Index (IMPI):
  https://www.bfs.admin.ch/bfs/en/home/statistics/prices/imip.html
- Publicly published price barometers of the large Swiss portals
  (ImmoScout24 "Property prices per m²", Comparis "Immobilienpreise",
  RealAdvisor "Property prices"), which publish median asking prices per canton
  and municipality.

The values are **approximate median asking prices** for the reference period noted
in `SWISS_PROPERTY_DATA.meta.asOf`. They are rounded snapshot estimates intended
for comparison between locations, not a live market feed and not investment advice.
Listing counts are rough magnitudes of active buy listings.

## Daily automatic refresh (GitHub Actions)

The workflow `.github/workflows/refresh-property-data.yml` runs once a day
(04:17 UTC, also triggerable manually via "Run workflow"). It executes
`property/refresh-data.mjs`, which:

1. looks up the official IMPI dataset on opendata.swiss (CKAN API) and
   downloads its CSV resource,
2. extracts the national quarterly index series for single-family houses and
   owner-occupied apartments (column layout is auto-detected, so modest format
   changes survive),
3. computes indexation factors = latest quarter ÷ baseline quarter
   (`BASELINE_QUARTER` in the script, matching `meta.asOf` of the bundled
   snapshot),
4. writes `property/data-live.js` and commits it if the values changed.

The front-end scales the bundled CHF prices by these factors and appends
"indexed to BFS IMPI <quarter>" to the source badge. Factors outside 0.7–1.5
are rejected both by the script and by the front-end, so a malformed upstream
file can never distort the page. The IMPI is quarterly, so most daily runs
commit nothing.

If the upstream CSV layout changes beyond what the auto-detection handles, the
workflow fails with a diagnostic message; test locally with
`node property/refresh-data.mjs --csv <file> --out /tmp/data-live.js`.
When the bundled snapshot in `data.js` is re-compiled, set its new reference
period in `meta.asOf` **and** in `BASELINE_QUARTER` so factors restart at ~1.

## How to refresh the data manually

Two options:

1. **Edit `data.js`** — update the compact rows
   (`[cantonCode, cantonName, city, aptPriceM2, aptListings, aptMedianPrice, aptYoY, housePriceM2, houseListings, houseMedianPrice, houseYoY]`,
   `city === ""` = whole canton) and bump `meta.asOf`.
2. **Import a CSV at runtime** — the page accepts any CSV with the header
   `canton_code,canton,city,property_type,price_chf_per_m2,listings,median_price_chf,yoy_change_pct`
   (the last two columns are optional; `property_type` is `apartment` or `house`;
   empty `city` = whole canton). Files previously downloaded with the
   "Download result as CSV" button re-import as-is.

## CSV format

```
canton_code,canton,city,property_type,price_chf_per_m2,listings,median_price_chf,yoy_change_pct
ZH,Zürich,Zürich,apartment,17200,1150,1650000,4.8
ZH,Zürich,Zürich,house,16500,260,2850000,4.2
ZG,Zug,,apartment,16200,540,1580000,5.4
```
