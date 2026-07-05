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

## How to refresh the data

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
