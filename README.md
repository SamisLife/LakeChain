# LakeChain

**Sustainable supply chain intelligence for the Great Lakes region.**

LakeChain helps procurement teams source from Michigan manufacturers whose environmental footprint, watershed proximity, and community impact can be verified against public data and not marketing claims.

---

## The Cause & Impact

The Great Lakes hold **21% of the world's surface fresh water** and supply drinking water to 40 million people. Yet the Michigan manufacturing corridor, one of the densest in the United States, sits directly in those watersheds. Every facility that releases toxics into the Flint River, the Tittabawassee, or the Detroit River ultimately threatens a shared resource that no supply chain agreement can replace.

At the same time, communities like Flint, Saginaw, and Muskegon carry some of the highest unemployment rates in the Midwest. Procurement decisions made in corporate offices in Chicago or Columbus have direct effects on those labor markets, for better or worse.

LakeChain exists at that intersection. It asks a simple question: **what if sourcing decisions were made with the same rigor applied to cost and lead time, but applied to environmental and community impact?**

By surfacing EPA Toxic Release Inventory data, Great Lakes watershed sensitivity, BLS county unemployment statistics, and PFAS contamination records in a single procurement interface, LakeChain gives buyers the information they need to favor suppliers who are genuinely better.

---

## Data Sources

LakeChain is built entirely on public, verifiable datasets. No proprietary scores. No opaque ratings. Every number traces back to a government source.

### EPA Toxic Release Inventory (TRI)
- **What it is:** Annual facility-level reports of toxic chemical releases, required under EPCRA Section 313
- **Coverage:** 769 Michigan manufacturing facilities across all Great Lakes watersheds
- **Fields used:** RSEI hazard score, total releases (lb), water pathway releases (lb), chemical identity, waste managed (lb), source reduction activities count
- **PFAS detection:** 11 specific compounds by CAS number (PFOA, PFOS, PFNA, PFDA, PFDoA, PFBA, PFHxA, PFHpA, PFBS, PFHxS, PFOSA) plus catch-all patterns for perfluoro/polyfluoroalkyl/fluorotelomer families
- **Source:** EPA TRI Explorer (tri.epa.gov)

### RSEI (Risk-Screening Environmental Indicators)
- **What it is:** EPA's toxicity-weighted hazard model that converts raw release pounds into a health-risk magnitude
- **How it's used:** Normalised by 3-digit NAICS sector into a 0–35 point environmental sub-score, so a plastics facility and a metals facility are compared against their own industry peers, not against each other
- **Why it matters:** Raw release volume is misleading — 1 lb of dioxin is not the same as 1 lb of sodium chloride. RSEI corrects for this

### USGS National Watershed Boundary Dataset (HUC8)
- **What it is:** 8-digit Hydrologic Unit Code polygons covering all US watersheds
- **How it's used:** Point-in-polygon assignment (via Turf.js) places each TRI facility in its upstream watershed; a sensitivity weight (0.18–0.95) reflects how ecologically stressed that watershed already is
- **Sensitivity examples:** Tittabawassee 0.95 (Dow Chemical legacy contamination), Flint 0.90 (water crisis), Kalamazoo 0.85 (PCB spill), Au Sable 0.25 (protected trout water), Tahquamenon 0.18 (Wild & Scenic)

### BLS Local Area Unemployment Statistics (LAUS)
- **What it is:** Monthly county-level unemployment rates published by the Bureau of Labor Statistics
- **Series format:** `LAUCN26{county_fips_3}0000000003` — where `26` is Michigan's state FIPS code and measure code `3` is the unemployment rate
- **How it's used:** Fetched in batches of 25 series (BLS public API limit), cached for the server process lifetime, then used to compute an economic multiplier: facilities in high-unemployment counties score higher because their jobs have greater community impact
- **Fallback:** If the BLS API is unreachable, hardcoded 2024 annual averages for all 67 Michigan TRI counties are used automatically
- **Michigan state average:** 4.2% (used as the baseline delta reference throughout the UI)

---

## How It Works

### Scoring Model

Every facility receives a composite score (0–99) built from three independently traceable dimensions:

| Dimension | Weight | What it measures |
|---|---|---|
| Environmental Impact | 40% | RSEI hazard (sector-normalized) + water pathway exposure + watershed sensitivity |
| Transport Proximity | 35% | Haversine distance from buyer city; penalty of −1 pt per 4 miles (0 pts at 400 mi, 95 pts at 20 mi) |
| Economic Multiplier | 25% | BLS county unemployment premium — high-unemployment counties score higher |
| PFAS Penalty | −25 pts | Flat deduction for any EPA-confirmed PFAS release, regardless of volume |

**Environmental sub-score breakdown:**
- RSEI hazard percentile (sector-normalized): 0–35 pts
- Water release pathway (% of releases going to waterways + volume): 0–30 pts
- Watershed sensitivity weight: 0–20 pts
- Source reduction activities (2+ = 15 pts, 1 = 8 pts, 0 = 0 pts): 0–15 pts

**Economic multiplier formula:**
```
base:  50 pts (state average)
≥9%:  +38 pts   (severe distress — Flint/Genesee tier)
≥7%:  +28 pts   (elevated stress)
≥5.5%: +16 pts  (above average)
≥4.5%: +8 pts   (slightly above)
<3.5%: −10 pts  (below average)
<2.5%: −15 pts  (very low — indicates buyer subsidy of already-healthy markets)
+ facility scale bonus (waste managed >10M lb: +8 pts; >1M lb: +4 pts)
+ source reduction bonus (+2 per activity, capped at +8)
```

### PFAS "Forever Chemical" Treatment

PFAS compounds do not biodegrade. A facility that released PFAS once may still be contaminating groundwater feeding into Lake Michigan decades later. LakeChain treats PFAS differently from other chemicals:

- **−25 point penalty** applied to the overall composite score regardless of release volume (even managed/transferred quantities trigger this)
- **Force surfacing:** PFAS facilities that would otherwise fall below the top-20 result cutoff are appended to every search result — procurement managers need to see them precisely because they might try to exclude them
- **Compound-level detail:** Each facility shows which specific PFAS compound was detected, its EPA TRI release amount (or "managed, no direct release"), and Great Lakes–specific health context (Wolverine World Wide/Rockford PFOA groundwater plume, Camp Grayling/Selfridge PFOS contamination, etc.)
- **Visual treatment:** Red node color, dashed spoke lines, pulsing warning ring, red card border — the UI makes PFAS facilities impossible to overlook

### Query Decomposition

When a buyer types a sourcing query (e.g., *"I need precision CNC machined titanium aerospace parts, ISO 9001 required"*), IBM Granite 3-8B Instruct parses it into:

```json
{
  "naics3Digits": ["332", "336"],
  "keywords": ["precision", "titanium", "aerospace", "CNC"],
  "certificationHints": ["ISO 9001"],
  "sectorLabel": "Precision Fabricated Metals"
}
```

This decomposition drives the initial facility ranking — NAICS code match and keyword overlap are combined with the composite score to surface the most relevant results first.

### Watershed Zone Assignment

Facility coordinates are checked against USGS HUC8 polygons using point-in-polygon geometry (Turf.js). The watershed code prefix maps to Great Lake zones:

| HUC8 prefix | Zone |
|---|---|
| `0403` | Lake Superior |
| `0404`, `0406`, `0407`, `0408` | Lake Huron |
| `0409`, `0410` | Lake Erie |
| `0405` | Lake Michigan |
| `0404` (St. Marys sub-basin) | St. Marys River |

---

## The Workflow

### Data Pipeline (run once)

```bash
npm run preprocess
```

This script (`scripts/preprocess.cjs`) processes the raw EPA TRI CSV (769 Michigan facilities across all Great Lakes watersheds):

1. **Parse** — reads TRI facility CSV row by row; aggregates multiple chemical rows per facility into a single record, accumulating RSEI scores, release totals, and PFAS flags
2. **Classify PFAS** — checks each chemical name against 11 specific CAS-mapped compounds and catch-all regex patterns
3. **Score** — computes environmental sub-scores per the weighted model above
4. **Assign watershed** — runs point-in-polygon against the 44 MB USGS HUC8 GeoJSON to place each facility in its watershed zone and apply the sensitivity weight
5. **Simplify geometry** — reduces the watershed GeoJSON to a browser-deliverable size (tolerance 0.008°, retaining risk stats in feature properties)
6. **Output** — writes `src/data/processed/facilities.json` (facility records with scores), `src/data/processed/watershed-risk.json` (aggregated watershed stats), and `public/data/watersheds-simple.geojson` (map layer)

### Search Request Flow

```
User query + buyer city
        │
        ▼
POST /api/search
        │
        ├─► IBM Granite 3-8B  ──► NAICS codes + keywords + cert hints
        │   (watsonx.ai)
        │
        ├─► BLS LAUS API  ──────► County unemployment rates (cached)
        │   (83 Michigan counties)
        │
        └─► 769 TRI facilities
                │
                ├─ NAICS relevance score  ×0.5
                ├─ Keyword overlap        ×0.5
                ├─ Environmental score    ×0.40
                ├─ Transport distance     ×0.35
                ├─ Economic multiplier    ×0.25
                └─ PFAS penalty          −25
                │
                ▼
        Ranked top-20 + PFAS overflow
                │
                ▼
        Manufacturer[] → Dashboard
```

### User Interface Flow

1. **Discovery screen** — buyer enters a sourcing query (e.g., "stamped metal automotive components, 5,000 units") and selects their Michigan city
2. **Loading** — animated overlay while Granite decomposes the query and BLS data is fetched
3. **Dashboard** — three-panel layout:
   - **Left:** Ranked supplier cards with score rings, watershed risk badges, 3-axis score bars (Watershed Impact, Economic Multiplier, Transport Proximity), PFAS banners, certification tags, and expandable descriptions
   - **Top right:** Great Lakes choropleth map with D3/GeoJSON — facility markers sized/colored by score, pulsing red rings for PFAS facilities, county unemployment tooltip with delta bar
   - **Bottom right:** Supply network radial graph — facilities orbit a center buyer node, grouped into arc sectors by watershed zone, physics-simulated with spring forces and collision resolution
4. **Scenario bar** — natural language filter at the bottom of the dashboard (e.g., "ISO 14001 certified, score above 80, Lake Michigan basin only")
5. **Quick chips** — one-click preset filters: No PFAS, Within 150mi of Detroit, EGLE Certified Only, Lake Michigan Basin, Score ≥ 85
6. **PFAS toggle** — header-level button hides/shows all PFAS facilities with a count badge
7. **Graph duel view** — hover any graph node for a tooltip; pin up to 2 facilities (bookmark icon); press COMPARE for a side-by-side metric duel with animated fill bars and a winner summary

---

## Integrations

### IBM watsonx.ai — IBM Granite 3-8B Instruct

**Role:** Query intelligence layer — converts free-text sourcing requests into structured NAICS + keyword + certification signals

**Model:** `ibm/granite-3-8b-instruct`

**How it's used:**
- A single structured prompt is sent to the Granite 3-8B Instruct model on each search request
- The model returns a compact JSON object (NAICS codes, keywords, certification hints, sector label) with `max_new_tokens: 120` and `temperature: 0.1` for deterministic extraction
- The response drives the initial NAICS-weighted facility relevance ranking before the environmental/transport/economic composite score is applied

**Authentication:** IBM IAM token exchange (`urn:ibm:params:oauth:grant-type:apikey`) with the IBM Cloud API key; tokens are short-lived and fetched per request

**Graceful fallback:** If `WATSONX_API_KEY` or `WATSONX_PROJECT_ID` are absent, LakeChain falls back to a deterministic keyword-to-NAICS rule table (17 sector mappings) so the app remains fully functional without cloud credentials. The Granite path adds sophistication — understanding queries like *"mycelium-based packaging alternatives"* or *"forged titanium landing gear components"* — but the fallback handles common manufacturing terminology robustly.

**Why Granite specifically:** IBM Granite models are designed for enterprise and regulated-industry use cases where auditability and controlled output matter. For a procurement tool making environmental claims, a model with clear documentation and predictable structured-output behavior is more appropriate than a general-purpose chat model.

### EPA TRI (Toxic Release Inventory)

Static dataset, downloaded and preprocessed offline. The TRI provides the environmental backbone: RSEI hazard scores, release volumes by pathway (water, air, land, off-site), PFAS chemical identity, and source reduction activity counts. All facility-level data shown in LakeChain traces back to the TRI record.

### BLS Local Area Unemployment Statistics

Live API integration. County unemployment rates are fetched from `api.bls.gov/publicAPI/v2/timeseries/data/` at server startup and cached for the process lifetime. Batched in groups of 25 series to stay within the public API rate limit. The rates feed the economic multiplier score and all the unemployment UI elements (delta bars, county impact sentences, card annotations).

### USGS National Watershed Boundary Dataset

Static GeoJSON, preprocessed offline. The 44 MB HUC8 polygon file is simplified to a browser-deliverable size and enriched with watershed risk metadata during the preprocess step. Used both for facility zone assignment (server-side) and the choropleth map layer (client-side).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS with custom `lc-*` design tokens, JetBrains Mono |
| Animation | Framer Motion (transitions), requestAnimationFrame (physics loop) |
| Graph physics | D3-force (spring + collision simulation), direct SVG DOM mutation |
| Geospatial | D3-geo, Turf.js (point-in-polygon), TopoJSON, react-simple-maps |
| Charts | Recharts (score rings, bar charts) |
| Data pipeline | Node.js script, csv-parse, Turf.js |
| AI | IBM watsonx.ai — Granite 3-8B Instruct |
| Environmental data | EPA TRI, EPA RSEI |
| Labor data | BLS LAUS |
| Watershed data | USGS NHD HUC8 |

---

## Getting Started

### Prerequisites

- Node.js 18+
- An IBM Cloud account with a watsonx.ai project (optional — fallback works without it)

### Setup

```bash
git clone https://github.com/SamisLife/LakeChain.git
cd LakeChain
npm install

# Copy and fill in credentials
cp .env.local.example .env.local

# Run the data preprocessing pipeline (required once)
npm run preprocess

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```bash
# .env.local
WATSONX_API_KEY=your_ibm_cloud_api_key
WATSONX_PROJECT_ID=your_watsonx_project_id
WATSONX_URL=https://us-south.ml.cloud.ibm.com   # default region
```

---

## Project Structure

```
lakechain/
├── data/                        # Raw source data (not committed)
│   ├── *.csv                    # EPA TRI facility export
│   └── *.geojson                # USGS HUC8 watershed polygons
├── scripts/
│   └── preprocess.cjs           # Data pipeline (run once)
├── src/
│   ├── app/
│   │   ├── api/search/route.ts  # POST /api/search — scoring & ranking
│   │   └── page.tsx             # Discovery screen & app shell
│   ├── components/
│   │   ├── Dashboard.tsx        # Main 3-panel layout
│   │   ├── GreatLakesMap.tsx    # D3 choropleth map
│   │   ├── SupplyChainGraph.tsx # Radial physics graph + duel view
│   │   ├── ManufacturerCard.tsx # Supplier card with scores & PFAS
│   │   └── ScenarioBar.tsx      # Natural language filter bar
│   ├── lib/
│   │   ├── watsonx.ts           # IBM Granite 3-8B integration
│   │   ├── bls.ts               # BLS LAUS county unemployment
│   │   └── scenario.ts          # Scenario parsing & filtering
│   └── data/
│       └── manufacturers.ts     # Michigan city coordinates
└── public/data/
    └── watersheds-simple.geojson  # Simplified watershed map layer
```

---
