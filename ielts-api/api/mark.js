/* ielts-api/api/mark.js — server-side proxy to Anthropic for the IELTS Lab.
 *
 * Why this exists: so the candidate's browser never needs an Anthropic API
 * key. The key lives ONLY as a server env var (ANTHROPIC_API_KEY) on this
 * specific Vercel project. The frontend on coin-maker3.github.io POSTs the
 * Anthropic request body here; this function forwards it with the key.
 *
 * This project is intentionally a SEPARATE Vercel project from the 2ww
 * triage project — it lives in the ielts-api/ subfolder and its Root
 * Directory in Vercel is set to ielts-api/, so the two deploys never collide.
 */

const ALLOWED_ORIGINS = [
  "https://coin-maker3.github.io",
];

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: { message: "method not allowed" } });

  // Cheap origin-based abuse filter. Determined attackers can spoof headers,
  // but this catches casual curl-from-elsewhere traffic.
  const referer = req.headers.referer || "";
  const fromUs = ALLOWED_ORIGINS.some((o) => origin === o || referer.startsWith(o));
  if (!fromUs) return res.status(403).json({ error: { message: "forbidden origin" } });

  const KEY = process.env.ANTHROPIC_API_KEY;
  if (!KEY) {
    return res.status(503).json({
      error: { message: "Server key not configured. The Vercel env var ANTHROPIC_API_KEY is missing." },
    });
  }

  // Defensive limit on body size — refuse anything obviously oversized.
  const body = req.body || {};
  const approxSize = JSON.stringify(body).length;
  if (approxSize > 50_000) {
    return res.status(413).json({ error: { message: "request body too large" } });
  }

  // Belt-and-braces: pin model + token cap server-side so a hostile client
  // can't ask for the most expensive thing on our dime.
  const allowedModels = new Set([
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
  ]);
  if (!allowedModels.has(body.model)) {
    return res.status(400).json({ error: { message: "model not allowed by proxy" } });
  }
  if (typeof body.max_tokens !== "number" || body.max_tokens > 4096) {
    body.max_tokens = 4096;
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", "application/json");
    return res.send(text);
  } catch (err) {
    return res.status(502).json({
      error: { message: "Upstream call failed: " + (err && err.message ? err.message : String(err)) },
    });
  }
}
