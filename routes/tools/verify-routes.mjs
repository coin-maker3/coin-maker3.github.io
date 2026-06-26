#!/usr/bin/env node
/*
 * Recheck curated routes for a centre: geocode every road, confirm it exists and
 * sits near the centre, route the whole loop through OSRM, and flag anything
 * wrong. No API key needed (Nominatim + OSRM).
 *
 * Usage:  node verify-routes.mjs nuneaton
 *
 * Flags per route:
 *   ✗ MISSING  — road didn't geocode at all (likely wrong/misspelt name)
 *   ⚠ FAR      — geocoded >6 km from the test centre (probably the wrong road)
 *   ⚠ DETOUR   — a single leg is unrealistically long (waypoints don't connect)
 *   ⚠ LENGTH   — total loop <3 km or >35 km (not a believable test route)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROUTES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const UA = "RouteReady-verify/1.0 (https://coin-maker3.github.io/routes/)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadJsGlobal(file, name) {
  const win = {};
  new Function("window", readFileSync(join(ROUTES_DIR, file), "utf8"))(win);
  return win[name];
}
function haversine(a, b) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
async function geocode(road, town) {
  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=gb&q=${encodeURIComponent(`${road}, ${town}, UK`)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-GB" } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.length ? [parseFloat(j[0].lat), parseFloat(j[0].lon)] : null;
}
async function osrmKm(waypoints) {
  const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(";");
  const r = await fetch(`${OSRM}${coords}?overview=false`);
  if (!r.ok) return null;
  const j = await r.json();
  return j.routes?.length ? j.routes[0].distance / 1000 : null;
}

const centreId = process.argv[2];
if (!centreId) { console.error("Usage: node verify-routes.mjs <centreId>"); process.exit(1); }

const centre = (loadJsGlobal("data.js", "TEST_CENTRES") || []).find((c) => c.id === centreId);
if (!centre) { console.error(`Unknown centreId "${centreId}".`); process.exit(1); }
const routes = (loadJsGlobal("curated.js", "CURATED") || {})[centreId] || [];
if (!routes.length) { console.error(`No curated routes for "${centreId}".`); process.exit(1); }

console.log(`\nVerifying ${routes.length} routes for ${centre.name} (${centre.town})\n`);
const centrePt = [centre.lat, centre.lng];
const geoCache = new Map();
let totalFlags = 0;

for (const route of routes) {
  const issues = [];
  const pts = [centrePt];
  for (const road of route.waypoints) {
    let pt = geoCache.get(road);
    if (pt === undefined) {
      pt = await geocode(road, centre.town);
      geoCache.set(road, pt);
      await sleep(1100); // Nominatim rate limit
    }
    if (!pt) { issues.push(`✗ MISSING: ${road}`); continue; }
    const km = haversine(centrePt, pt) / 1000;
    if (km > 6) issues.push(`⚠ FAR: ${road} (${km.toFixed(1)} km from centre)`);
    pts.push(pt);
  }
  pts.push(centrePt);

  // detour check: any straight-line leg > 5 km suggests a non-connecting waypoint
  for (let i = 1; i < pts.length; i++) {
    const legKm = haversine(pts[i - 1], pts[i]) / 1000;
    if (legKm > 5) issues.push(`⚠ DETOUR: leg ${i} jumps ${legKm.toFixed(1)} km`);
  }

  const km = await osrmKm(pts);
  if (km != null && (km < 3 || km > 35)) issues.push(`⚠ LENGTH: loop is ${km.toFixed(1)} km`);

  const tag = issues.length ? "❌" : "✅";
  console.log(`${tag} ${route.name}${km != null ? `  (${km.toFixed(1)} km)` : ""}`);
  issues.forEach((s) => console.log(`     ${s}`));
  totalFlags += issues.length;
}

console.log(`\n${totalFlags ? "❌" : "✅"} ${totalFlags} issue(s) across ${routes.length} routes.`);
console.log("Fix flagged roads in routes/curated.js (and re-run), then drive to confirm.\n");
