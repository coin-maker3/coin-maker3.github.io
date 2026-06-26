# RouteReady extractor — YouTube → route (Gemini)

Turns a **public YouTube dashcam video** of a driving-test route into a RouteReady
route. Run it locally with your own Gemini API key; commit the output and the
app picks it up automatically.

## Pipeline

```
YouTube URL
   │  Gemini watches the video → ordered manoeuvres + road names (structured JSON)
   ▼
Geocode each road near the centre  (OpenStreetMap Nominatim, ~1 req/sec)
   │  drops roads it can't place within 15 km of the centre
   ▼
OSRM snaps the waypoints to real roads → geometry + turn-by-turn steps
   ▼
routes/community/<id>.json   +   community/manifest.json   (flagged verified:false)
```

## Setup & run

```bash
cd routes/tools
npm install
export GEMINI_API_KEY=your_key_here          # uses your key/quota
# optional: export GEMINI_MODEL=gemini-2.5-flash

node extract-route.mjs "<youtubeUrl>" "<centreId>" --name "Optional name"
# centreId must match an id in ../data.js, e.g. cardiff-llanishen
```

The app loads `community/manifest.json` at runtime and shows these routes under
the matching centre, badged **"Community · unverified"** with a ⚠️.

## Important — accuracy & safety

- Output is **always `verified:false`**. Video-derived turns are a *draft*, not
  gospel. A human must **drive the route** to confirm it before it's trusted —
  this is deliberately the opposite of competitors whose unverified routes send
  people down dead ends and into illegal turns.
- Gemini reads road names off signs; where signs aren't visible those roads are
  skipped, so coverage is partial. Treat results as a starting point.

## Legal

- A **route** (which public roads, in what order) is a *fact* and not
  copyrightable. We extract that fact and re-express it as our own data.
- We **never** download, copy, or republish the source video — we only store the
  URL as attribution.
- **Do not bulk-scrape** YouTube (it breaks their Terms of Service). Curate
  individual videos by hand. Bulk automation is out of scope for this tool.
