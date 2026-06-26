#!/usr/bin/env node
/*
 * Do a whole test centre: find its route videos, watch each with Gemini, and
 * build every successful one into a map route.
 *
 * Usage:
 *   node build-centre.mjs <centreId> [--count 15] [--download]
 *   node build-centre.mjs <centreId> --urls urls.txt   # use your own curated list
 *
 * Process-isolated per video: one bad video never kills the run.
 */
import { loadCentres, findVideos, extractAndSave, sleep } from "./lib.mjs";
import { readFileSync } from "node:fs";

const [, , centreId, ...rest] = process.argv;
if (!centreId) { console.error("Usage: node build-centre.mjs <centreId> [--count N] [--download] [--urls file]"); process.exit(1); }
if (!process.env.GEMINI_API_KEY) { console.error("Set GEMINI_API_KEY first."); process.exit(1); }

const centre = loadCentres().find((c) => c.id === centreId);
if (!centre) { console.error(`Unknown centreId "${centreId}".`); process.exit(1); }

const opt = (flag, def) => rest.includes(flag) ? rest[rest.indexOf(flag) + 1] : def;
const count = parseInt(opt("--count", "15"), 10);
const download = rest.includes("--download");
const urlsFile = opt("--urls", null);

let urls;
if (urlsFile) {
  urls = readFileSync(urlsFile, "utf8").split("\n").map((s) => s.trim()).filter((s) => s && !s.startsWith("#"));
  console.log(`Using ${urls.length} curated URLs from ${urlsFile}`);
} else {
  console.log(`Searching YouTube for "${centre.name} driving test route"…`);
  urls = await findVideos(`${centre.name} driving test route`, count);
  console.log(`Found ${urls.length} candidate videos.`);
}

const results = { ok: [], failed: [] };
for (let i = 0; i < urls.length; i++) {
  const url = urls[i];
  console.log(`\n[${i + 1}/${urls.length}] ${url}`);
  try {
    const r = await extractAndSave({ url, centreId, download, log: (m) => console.log(m) });
    console.log(`  ✅ ${r.km} km · ${r.steps} steps`);
    results.ok.push(r.id);
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
    results.failed.push({ url, reason: e.message });
  }
  await sleep(1500); // be polite between videos
}

console.log(`\n──────── ${centre.name} ────────`);
console.log(`✅ built ${results.ok.length} routes   ✗ skipped ${results.failed.length}`);
console.log(`All saved to routes/community/ and flagged UNVERIFIED — drive them to confirm before trusting.`);
