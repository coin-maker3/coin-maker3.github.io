#!/usr/bin/env node
/* Discover candidate YouTube route videos for a centre (yt-dlp search, no key).
 * Usage: node find-videos.mjs <centreId> [count]
 */
import { loadCentres, findVideos } from "./lib.mjs";

const [, , centreId, countArg] = process.argv;
if (!centreId) { console.error("Usage: node find-videos.mjs <centreId> [count]"); process.exit(1); }
const centre = loadCentres().find((c) => c.id === centreId);
if (!centre) { console.error(`Unknown centreId "${centreId}".`); process.exit(1); }

const count = parseInt(countArg || "15", 10);
const query = `${centre.name} driving test route`;
console.error(`Searching YouTube: "${query}" (top ${count})…`);
try {
  const urls = await findVideos(query, count);
  urls.forEach((u) => console.log(u)); // stdout = clean list you can pipe to build-centre
  console.error(`Found ${urls.length} candidates.`);
} catch (e) {
  console.error("✗ " + e.message + "  (is yt-dlp installed?)");
  process.exit(1);
}
