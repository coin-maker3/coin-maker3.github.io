/*
 * RouteReady extractor — shared library
 * Watch a YouTube test-route video with Gemini → ordered manoeuvres → geocode
 * near the centre → snap to roads with OSRM → a map-ready, UNVERIFIED route.
 */
import { GoogleGenAI, Type } from "@google/genai";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROUTES_DIR = join(__dirname, "..");
export const COMMUNITY_DIR = join(ROUTES_DIR, "community");
export const MANIFEST = join(COMMUNITY_DIR, "manifest.json");

const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const UA = "RouteReady-extractor/1.0 (https://coin-maker3.github.io/routes/)";
export const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const videoId = (url) => (url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/) || [])[1] || slug(url).slice(-11);

export function haversine(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function loadCentres() {
  // data.js is JS (window.TEST_CENTRES = [...] with unquoted keys), not JSON —
  // run it with a stub window and read the array back. (Trusted local file.)
  const src = readFileSync(join(ROUTES_DIR, "data.js"), "utf8");
  const win = {};
  // eslint-disable-next-line no-new-func
  new Function("window", src)(win);
  if (!Array.isArray(win.TEST_CENTRES)) throw new Error("Could not read TEST_CENTRES from data.js");
  return win.TEST_CENTRES;
}

/* ── YouTube discovery (yt-dlp search, no API key needed) ─────────────────── */
export async function findVideos(query, n = 15) {
  const { stdout } = await execFileP("yt-dlp",
    [`ytsearch${n}:${query}`, "--flat-playlist", "--print", "%(id)s"], { maxBuffer: 1 << 24 });
  return stdout.trim().split("\n").filter(Boolean).map((id) => `https://www.youtube.com/watch?v=${id}`);
}

/* ── Gemini: watch the video, return ordered manoeuvres ───────────────────── */
const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    routeName: { type: Type.STRING },
    isDrivingTest: { type: Type.BOOLEAN, description: "true only if this is genuinely an in-car driving route video" },
    summary: { type: Type.STRING },
    maneuvers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          order: { type: Type.INTEGER },
          action: { type: Type.STRING, description: "turn left | turn right | straight on | continue | take Nth exit at roundabout" },
          road: { type: Type.STRING, description: "road name exactly as on the sign; empty if not visible" },
          landmark: { type: Type.STRING }
        },
        required: ["order", "action", "road"]
      }
    }
  },
  required: ["routeName", "isDrivingTest", "maneuvers"]
};

async function uploadLocalVideo(ai, filePath) {
  let f = await ai.files.upload({ file: filePath, config: { mimeType: "video/mp4" } });
  while (f.state === "PROCESSING") { await sleep(3000); f = await ai.files.get({ name: f.name }); }
  if (f.state === "FAILED") throw new Error("Gemini failed to process the uploaded video");
  return { fileUri: f.uri, mimeType: f.mimeType || "video/mp4" };
}

async function downloadVideo(url, outPath) {
  await execFileP("yt-dlp",
    ["-f", "best[height<=360][ext=mp4]/best[height<=360]/best", "--no-playlist", "-o", outPath, url],
    { maxBuffer: 1 << 24 });
  return outPath;
}

async function watchVideo(ai, { url, download }) {
  let part, tmp;
  if (download) {
    tmp = join(COMMUNITY_DIR, "_tmp", videoId(url) + ".mp4");
    mkdirSync(dirname(tmp), { recursive: true });
    await downloadVideo(url, tmp);
    part = { fileData: await uploadLocalVideo(ai, tmp) };
  } else {
    part = { fileData: { fileUri: url } }; // Gemini fetches the YouTube URL directly
  }
  const prompt =
    `You are watching a UK driving-test practice route filmed from inside a car. ` +
    `List the driving manoeuvres IN ORDER from start to finish. For each give: action, ` +
    `the road name exactly as shown on road signs (leave empty if no sign is visible), and any landmark. ` +
    `Read the signs; do NOT invent road names. Ignore the driver's commentary, intros and adverts. ` +
    `Set isDrivingTest=false if this is not actually an in-car driving route.`;

  try {
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ parts: [part, { text: prompt }] }],
      config: { responseMimeType: "application/json", responseSchema: SCHEMA }
    });
    return JSON.parse(resp.text);
  } finally {
    if (tmp) try { rmSync(tmp, { force: true }); } catch {}
  }
}

/* ── geocode + OSRM → geometry/steps ──────────────────────────────────────── */
async function geocode(road, centre) {
  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(`${road}, ${centre.town}, UK`)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB" } });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.length) return null;
  const pt = [parseFloat(j[0].lat), parseFloat(j[0].lon)];
  return haversine([centre.lat, centre.lng], pt) < 15000 ? pt : null; // reject wrong same-named roads
}

function instructionText(m, road) {
  const where = road ? ` onto ${road}` : "";
  switch (m.type) {
    case "depart": return "Start the route" + (road ? ` on ${road}` : "");
    case "arrive": return "You have arrived back at the test centre";
    case "turn": case "end of road": return `Turn ${m.modifier || ""}${where}`.trim();
    case "roundabout": case "rotary": return `At the roundabout, take exit ${m.exit || ""}`.trim() + where;
    case "merge": return `Merge ${m.modifier || ""}${where}`.trim();
    case "fork": return `Keep ${m.modifier || ""}${where}`.trim();
    default: return `Continue${where}`;
  }
}

async function snapToRoads(waypoints) {
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const res = await fetch(`${OSRM}${coords}?overview=full&geometries=geojson&steps=true`);
  if (!res.ok) throw new Error("OSRM routing failed");
  const j = await res.json();
  if (!j.routes?.length) throw new Error("OSRM returned no route");
  const R = j.routes[0];
  const steps = [];
  R.legs.forEach((leg) => leg.steps.forEach((st) => {
    const [lng, lat] = st.maneuver.location;
    steps.push({ loc: [lat, lng], text: instructionText(st.maneuver, st.name), dist: st.distance });
  }));
  return { geometry: R.geometry.coordinates.map(([lng, lat]) => [lat, lng]), steps, distance: R.distance, duration: R.duration };
}

/* ── persistence ──────────────────────────────────────────────────────────── */
export function saveRoute(route) {
  if (!existsSync(COMMUNITY_DIR)) mkdirSync(COMMUNITY_DIR, { recursive: true });
  writeFileSync(join(COMMUNITY_DIR, `${route.id}.json`), JSON.stringify(route, null, 2));
  let manifest = [];
  if (existsSync(MANIFEST)) { try { manifest = JSON.parse(readFileSync(MANIFEST, "utf8")); } catch {} }
  manifest = manifest.filter((m) => m.file !== `${route.id}.json`);
  manifest.push({ file: `${route.id}.json`, centreId: route.centreId, name: route.name, verified: false, source: route.source });
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
}

/* ── top-level: one video → one saved, unverified, map-ready route ────────── */
export async function extractAndSave({ url, centreId, name, download = false, log = () => {} }) {
  const centre = loadCentres().find((c) => c.id === centreId);
  if (!centre) throw new Error(`Unknown centreId "${centreId}" (check ../data.js)`);
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  log(`  watching video…`);
  const x = await watchVideo(ai, { url, download });
  if (x.isDrivingTest === false) throw new Error("Gemini says this isn't a driving-route video — skipped");

  const roads = [];
  let last = null;
  for (const m of (x.maneuvers || [])) {
    const road = (m.road || "").trim();
    if (road && road !== last) { roads.push(road); last = road; }
  }
  if (roads.length < 2) throw new Error("not enough named roads to build a route");

  log(`  geocoding ${roads.length} roads…`);
  const waypoints = [[centre.lat, centre.lng]];
  for (const road of roads) {
    const pt = await geocode(road, centre);
    await sleep(1100); // Nominatim rate limit
    if (pt) waypoints.push(pt);
  }
  waypoints.push([centre.lat, centre.lng]);
  if (waypoints.length < 4) throw new Error("too few roads geocoded near the centre");

  log(`  snapping ${waypoints.length} waypoints to roads…`);
  const snapped = await snapToRoads(waypoints);

  const routeName = name || x.routeName || `${centre.town} community route`;
  const route = {
    id: `${centreId}-${videoId(url)}`,
    centreId, name: routeName, difficulty: "Community", verified: false,
    source: url,
    notes: "Rebuilt from a public video — NOT yet verified. Drive with care and obey all signs.",
    summary: x.summary || "",
    ...snapped,
    generatedAt: new Date().toISOString()
  };
  saveRoute(route);
  return { id: route.id, km: (route.distance / 1000).toFixed(1), steps: route.steps.length, roads: roads.length };
}
