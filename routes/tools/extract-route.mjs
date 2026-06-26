#!/usr/bin/env node
/* Single video → one map route.
 * Usage: node extract-route.mjs <youtubeUrl> <centreId> [--name "..."] [--download]
 */
import { extractAndSave } from "./lib.mjs";

const [, , url, centreId, ...rest] = process.argv;
if (!url || !centreId) { console.error('Usage: node extract-route.mjs <youtubeUrl> <centreId> [--name "..."] [--download]'); process.exit(1); }
if (!process.env.GEMINI_API_KEY) { console.error("Set GEMINI_API_KEY first."); process.exit(1); }

const name = rest.includes("--name") ? rest[rest.indexOf("--name") + 1] : null;
const download = rest.includes("--download");

try {
  const r = await extractAndSave({ url, centreId, name, download, log: (m) => console.log(m) });
  console.log(`✅ ${r.id}  —  ${r.km} km · ${r.steps} steps · ${r.roads} roads · UNVERIFIED`);
} catch (e) {
  console.error("✗ " + e.message);
  process.exit(1);
}
