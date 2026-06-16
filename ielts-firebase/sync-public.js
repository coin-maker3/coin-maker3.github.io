// Sync ../ielts/*.* into ./public/ before each Firebase Hosting deploy.
// Firebase Hosting requires the public folder to live below firebase.json,
// so we copy the IELTS app files into ielts-firebase/public/ at deploy time.
// The folder is git-ignored — it's regenerated every deploy.
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "ielts");
const DEST = path.join(__dirname, "public");
const FILES = ["index.html", "app.js", "styles.css", "tasks.js"];

fs.rmSync(DEST, { recursive: true, force: true });
fs.mkdirSync(DEST);
for (const f of FILES) {
  const from = path.join(SRC, f);
  const to = path.join(DEST, f);
  fs.copyFileSync(from, to);
  process.stdout.write(`  ${f}\n`);
}
process.stdout.write(`Synced ${FILES.length} files from ${SRC} -> ${DEST}\n`);
