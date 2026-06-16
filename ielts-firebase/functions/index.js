/* IELTS Writing Lab — markEssay Cloud Function.
 *
 * Holds the Anthropic API key as a Secret Manager secret (ANTHROPIC_API_KEY)
 * so the candidate's browser never sees it. The frontend POSTs the Anthropic
 * request body here; this function forwards it with the key.
 *
 * Lives in the lds-part2-simulator Firebase project as a second codebase
 * ("ielts") so deploys don't collide with the MolarMock functions.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// Hosts that may call this function from a browser.
const ALLOWED_ORIGINS = [
  "https://band7-lab.web.app",
  "https://band7-lab.firebaseapp.com",
  "https://coin-maker3.github.io",
];

// Models the client is allowed to ask for — pinned server-side so a hostile
// client can't force us to use the most expensive thing.
const ALLOWED_MODELS = new Set([
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
]);

exports.markEssay = onRequest(
  {
    region: "europe-west2",
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 180,
    memory: "256MiB",
    cors: false, // we set CORS headers ourselves so we can be strict
  },
  async (req, res) => {
    const origin = req.headers.origin || "";
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    res.set("Access-Control-Allow-Origin", allowed);
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Vary", "Origin");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: { message: "method not allowed" } });
      return;
    }

    const referer = req.headers.referer || "";
    const fromUs = ALLOWED_ORIGINS.some((o) => origin === o || referer.startsWith(o));
    if (!fromUs) {
      res.status(403).json({ error: { message: "forbidden origin" } });
      return;
    }

    const body = req.body || {};
    const approxSize = JSON.stringify(body).length;
    if (approxSize > 50_000) {
      res.status(413).json({ error: { message: "request body too large" } });
      return;
    }

    if (!ALLOWED_MODELS.has(body.model)) {
      res.status(400).json({ error: { message: "model not allowed by proxy" } });
      return;
    }
    if (typeof body.max_tokens !== "number" || body.max_tokens > 4096) {
      body.max_tokens = 4096;
    }

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY.value(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      const text = await upstream.text();
      res.status(upstream.status);
      res.set("content-type", "application/json");
      res.send(text);
    } catch (err) {
      logger.error("Upstream call failed", { message: err && err.message });
      res.status(502).json({
        error: { message: "Upstream call failed: " + (err && err.message ? err.message : String(err)) },
      });
    }
  }
);
