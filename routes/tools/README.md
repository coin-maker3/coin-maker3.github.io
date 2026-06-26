# RouteReady extractor — YouTube → map routes (Gemini)

**Point it at a test centre. It finds the real route videos on YouTube, has
Gemini *watch* each one, and builds every route onto the app's map.**

```
centre ──▶ yt-dlp finds route videos ──▶ Gemini watches each (reads road signs)
       ──▶ geocode roads near the centre ──▶ OSRM snaps to real roads
       ──▶ routes/community/<id>.json (map-ready, flagged UNVERIFIED)
```

The app already loads `community/manifest.json` and shows these under the
matching centre, badged **"Community · unverified ⚠️"**.

## Setup (on your machine)

```bash
cd routes/tools
npm install                 # installs @google/genai
pipx install yt-dlp         # or: brew install yt-dlp  /  pip install yt-dlp
export GEMINI_API_KEY=your_key
# optional: export GEMINI_MODEL=gemini-2.5-flash   (default; use ...-pro for tricky footage)
```

## Do a whole centre (the main command)

```bash
node build-centre.mjs cardiff-llanishen --count 15
```
Finds the top 15 "Cardiff (Llanishen) driving test route" videos, watches each,
and builds every usable one. Process-isolated — one bad video won't stop the run.

Use your own curated list instead of auto-search (recommended for quality):
```bash
node find-videos.mjs cardiff-llanishen 25 > urls.txt   # then prune urls.txt by hand
node build-centre.mjs cardiff-llanishen --urls urls.txt
```

## One video at a time

```bash
node extract-route.mjs "https://youtu.be/VIDEO_ID" cardiff-llanishen --name "Llanishen Route 1"
```

## Direct URL vs `--download`

- **Default:** Gemini fetches the YouTube URL itself — simplest, no download.
- **`--download`:** `yt-dlp` grabs a 360p copy and uploads it via the Files API —
  more robust if direct-URL ingestion hits limits/quirks at volume. Slower.

## Accuracy & safety (read this)

- Output is **always `verified:false`**. Gemini reads signs off the footage; where
  signs aren't visible those roads are skipped, so coverage is partial and the
  route is a **draft**. A human must **drive it to confirm** before it's trusted.
  This is deliberately the opposite of competitors whose unverified routes send
  people into dead ends and illegal turns.
- Gemini also sets `isDrivingTest=false` for non-route videos, which are skipped.

## Legal

- A **route** (which public roads, in what order) is a *fact* — not copyrightable.
  We extract that fact and re-express it as our own data, storing only the source
  URL as attribution. We never copy or republish the video itself.
- `--download` saves a temporary 360p copy **only** long enough to upload to
  Gemini, then deletes it.
- Keep volumes sane and curate sources. Hammering YouTube/Nominatim/OSRM with
  thousands of automated requests breaks their terms and gets you rate-limited —
  these public endpoints aren't built for bulk harvesting. Self-host OSRM/geocoding
  and use the YouTube Data API if you ever scale up.
