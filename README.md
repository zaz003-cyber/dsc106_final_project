# When the Corn Belt Met the Satellites

An interactive explorable explanation built for **DSC 106 — Data Visualization, UC San Diego, Spring 2026.**

> How MODIS satellite imagery reveals what state-level averages have been hiding — a county-level journey through climate and crops across Iowa, Kansas, and Texas.

---

## How to view locally

The site is fully static. Because it loads CSV files via `fetch`, you cannot open `index.html` directly with `file://` — you need a tiny local server.

```bash
# from the project root
python -m http.server 8000
# then visit http://localhost:8000
```

Or with Node:

```bash
npx serve .
```

## How to deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `dsc106-final-project`).
2. Push everything in this folder to the repo's `main` branch.
3. In the repo settings → **Pages**, set the source to `main` / root, then save.
4. After a minute GitHub gives you a URL like `https://<username>.github.io/<repo>/`.

## Project structure

```
.
├── index.html          # scrollytelling page
├── styles.css          # data-journalism theme
├── js/
│   ├── main.js         # entry point: loads data, hands to sections
│   ├── utils.js        # shared constants + helpers
│   └── sections/
│       ├── intro-map.js     # US map highlighting 3 states
│       ├── reveal.js        # state-vs-county lie reveal
│       ├── time-machine.js  # flagship 3-state county scrubber + sparkline
│       ├── radial.js        # polar crop calendar
│       ├── scatter.js       # NDVI vs LST/Precip with state filter
│       └── day-night.js     # day vs night LST small multiples
├── data/
│   ├── state_data.csv          # state × month aggregates
│   └── county_data.csv         # ~5,500 rows: county × month
└── README.md
```

## Data sources

- **NASA MODIS MOD13A3** — monthly NDVI, 1 km (LP DAAC)
- **NASA MODIS MOD11A2** — 8-day LST Day & Night, 1 km (LP DAAC)
- **CHIRPS** — monthly precipitation, 5 km (UCSB Climate Hazards Center)
- **US Census TIGER/Line** — county boundary geometry, served via the [us-atlas](https://github.com/topojson/us-atlas) TopoJSON build (`counties-10m`)
- **US Census STATEFP codes** — 2-digit state identifiers (19 = Iowa, 20 = Kansas, 48 = Texas) used to filter counties

All raster bands extracted via **Google Earth Engine** and aggregated to the county level for Iowa (99 counties), Kansas (105 counties), and Texas (254 counties) — 5,496 county-month rows in total.

## Tech

D3.js v7 · scrollama · topojson-client · vanilla ES modules. No build step.
