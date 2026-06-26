#!/usr/bin/env node
/*
 * RouteReady — YouTube → route extractor
 * ─────────────────────────────────────────────────────────────────────────────
 * Turns a public YouTube dashcam video of a driving-test route into a RouteReady
 * route, by:
 *   1. asking Gemini to watch the video and list the ordered manoeuvres + roads
 *   2. geocoding each road near the test centre (OpenStreetMap Nominatim)
 *   3. snapping the waypoints to real roads (OSRM) → geometry + turn-by-turn steps
 *   4. writing routes/community/<id>.json  +  updating community/manifest.json
 *
 * The output is flagged  verified:false  ("Community · unverified") so the app
 * labels it clearly and never presents video-derived turns as gospel. A human
 * should drive/verify it before it's trusted — this is the guard against the
 * dangerous/illegal-turn problem that sinks competing apps.
 *
 * LEGAL: a *route* (which public roads, in what order) is a fact and not
 * copyrightable; we re-express it as our own data and never copy/republish the
 * source video. Do not bulk-scrape YouTube (that breaks their ToS) — curate.
 *
 * USAGE:
 *   export GEMINI_API_KEY=...            # your key
 *   npm install                          # in this folder
 *   node extract-route.mjs <youtubeUrl> <centreId> [--name "Route name"]
 *
 *   centreId must match an id in ../data.js (e.g. "cardiff-llanishen").
 *   Optional: GEMINI_MODEL (default gemini-2.5-flash)
 */

import { GoogleGenAI, Type } from "@google/genai";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_DIR = join(__dirname, "..");
const COMMUNITY_DIR = join(ROUTES_DIR, "community");
const MANIFEST = join(COMMUNITY_DIR, "manifest.json");

const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "RouteReady-extractor/1.0 (https://coin-maker3.github.io/routes/)";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

/* ── args ─────────────────────────────────────────────────────────────────── */
const [, , youtubeUrl, centreId, ...rest] = process.argv;
if (!youtubeUrl || !centreId) {
  console.error("Usage: node extract-route.mjs <youtubeUrl> <centreId> [--name \"...\"]");
  process.exit(1);
}
const nameFlag = rest.includes("--name") ? rest[rest.indexOf("--name") + 1] : null;
if (!process.env.GEMINI_API_KEY) {
  console.error("Set GEMINI_API_KEY in your environment first.");
  process.exit(1);
}

/* ── load the centre from the app's data.js ───────────────────────────────── */
function loadCentres() {
  const src = readFileSync(join(ROUTES_DIR, "data.js"), "utf8");
  const json = src.slice(src.indexOf("["), src.lastIndexOf("]") + 1);
  return JSON.parse(json);
}
const centre = loadCentres().find((c) => c.id === centreId);
if (!centre) { console.error(`Unknown centreId "${centreId}". Check ../data.js.`); process.exit(1); }
console.log(`▶ Centre: ${centre.name} (${centre.lat}, ${centre.lng})`);

/* ── 1. Gemini: watch the video, return ordered manoeuvres ────────────────── */
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    routeName: { type: Type.STRING },
    summary: { type: Type.STRING },
    maneuvers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.INTEGER },
          action: { type: Type.STRING, description: "e.g. 'turn left', 'turn right', 'straight on at roundabout', 'continue'" },
          road: { type: Type.STRING, description: "the road being joined/driven, exactly as seen on a sign; empty if unknown" },
          landmark: { type: Type.STRING, description: "any roundabout/junction/landmark, optional" }
        },
        required: ["order", "action", "road"]
      }
    }
  },
  required: ["routeName", "maneuvers"]
};

const PROMPT = `You are watching a UK driving-test practice route filmed from inside a car near the test centre "${centre.name}" (${centre.town}).
List the driving manoeuvres IN ORDER from start to finish. For each, give:
- action (turn left / turn right / straight on / continue / take Nth exit at roundabout),
- the road name as shown on road signs (use the exact spelling; leave empty if no sign is visible),
- any landmark or junction name.
Only report roads you can actually read or clearly infer from signage. Do not invent road names. Ignore intro/outro talking and adverts.`;

console.log(`▶ Asking ${MODEL} to read the route from the video…`);
const resp = await ai.models.generateContent({
  model: MODEL,
  contents: [{
    parts: [
      { fileData: { fileUri: youtubeUrl } },
      { text: PROMPT }
    ]
  }],
  config: { responseMimeType: "application/json", responseSchema: SCHEMA }
});

let extracted;
try { extracted = JSON.parse(resp.text); }
catch (e) { console.error("Gemini did not return valid JSON:\n", resp.text); process.exit(1); }

const maneuvers = (extracted.maneuvers || []).filter((m) => m.road && m.road.trim());
console.log(`▶ Gemini found ${extracted.maneuvers?.length || 0} manoeuvres (${maneuvers.length} with a usable road name).`);
if (maneuvers.length < 2) { console.error("Not enough named roads to build a route. Try a clearer video."); process.exit(1); }

/* ── 2. geocode each road near the centre ─────────────────────────────────── */
async function geocode(road) {
  const q = `${road}, ${centre.town}, UK`;
  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB" } });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.length) return null;
  const lat = parseFloat(j[0].lat), lng = parseFloat(j[0].lon);
  // sanity: must be within ~15km of the centre, else it's the wrong "High Street"
  const d = haversine([centre.lat, centre.lng], [lat, lng]);
  return d < 15000 ? [lat, lng] : null;
}
function haversine(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

console.log("▶ Geocoding roads (Nominatim, ~1 req/sec)…");
const waypoints = [[centre.lat, centre.lng]];
let lastRoad = null;
for (const m of maneuvers) {
  const road = m.road.trim();
  if (road === lastRoad) continue;       // skip consecutive duplicates
  lastRoad = road;
  const pt = await geocode(road);
  await sleep(1100);                      // respect Nominatim rate limit
  if (pt) { waypoints.push(pt); process.stdout.write(`  ✓ ${road}\n`); }
  else process.stdout.write(`  ✗ ${road} (not found / too far — skipped)\n`);
}
waypoints.push([centre.lat, centre.lng]); // loop back to centre
if (waypoints.length < 4) { console.error("Too few roads geocoded to form a route."); process.exit(1); }

/* ── 3. OSRM: snap to roads → geometry + steps ────────────────────────────── */
console.log(`▶ Routing ${waypoints.length} waypoints through OSRM…`);
function instructionText(m, road) {
  const where = road ? ` onto ${road}` : "";
  const dir = m.modifier || "";
  switch (m.type) {
    case "depart": return "Start the route" + (road ? ` on ${road}` : "");
    case "arrive": return "You have arrived back at the test centre";
    case "turn": case "end of road": return `Turn ${dir}${where}`.trim();
    case "roundabout": case "rotary": return `At the roundabout, take exit ${m.exit || ""}`.trim() + where;
    case "merge": return `Merge ${dir}${where}`.trim();
    case "fork": return `Keep ${dir}${where}`.trim();
    default: return `Continue${where}`;
  }
}
const coordStr = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
const osrmRes = await fetch(`${OSRM}${coordStr}?overview=full&geometries=geojson&steps=true`);
if (!osrmRes.ok) { console.error("OSRM routing failed."); process.exit(1); }
const osrm = await osrmRes.json();
if (!osrm.routes?.length) { console.error("OSRM returned no route."); process.exit(1); }
const R = osrm.routes[0];
const geometry = R.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
const steps = [];
R.legs.forEach((leg) => leg.steps.forEach((st) => {
  const [lng, lat] = st.maneuver.location;
  steps.push({ loc: [lat, lng], text: instructionText(st.maneuver, st.name), dist: st.distance });
}));

/* ── 4. write the route + update the manifest ─────────────────────────────── */
if (!existsSync(COMMUNITY_DIR)) mkdirSync(COMMUNITY_DIR, { recursive: true });
const routeName = nameFlag || extracted.routeName || `${centre.town} community route`;
const id = `${centreId}-${slug(routeName)}`.slice(0, 60);
const route = {
  id, centreId, name: routeName, difficulty: "Community", verified: false,
  source: youtubeUrl,
  notes: "Rebuilt from a public video — NOT yet verified. Drive with care and obey all signs.",
  summary: extracted.summary || "",
  distance: R.distance, duration: R.duration,
  geometry, steps,
  generatedAt: new Date().toISOString()
};
writeFileSync(join(COMMUNITY_DIR, `${id}.json`), JSON.stringify(route, null, 2));

let manifest = [];
if (existsSync(MANIFEST)) { try { manifest = JSON.parse(readFileSync(MANIFEST, "utf8")); } catch {} }
manifest = manifest.filter((m) => m.file !== `${id}.json`);
manifest.push({ file: `${id}.json`, centreId, name: routeName, verified: false, source: youtubeUrl });
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

console.log(`\n✅ Saved community/${id}.json`);
console.log(`   ${(R.distance / 1000).toFixed(1)} km · ${steps.length} steps · flagged UNVERIFIED`);
console.log(`   Review it in the app, then drive it to verify before trusting it.`);
