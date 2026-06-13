/* Vercel serverless function — the secure examiner proxy.
 *
 * The Anthropic API key lives ONLY here, as a private server environment
 * variable (ANTHROPIC_API_KEY) set in the Vercel dashboard. It is never sent
 * to the browser and never committed to the repo. The website calls /api/mark
 * and this function forwards the request to Anthropic using the server key, so
 * no visitor ever needs (or sees) a key.
 *
 * One-time setup (the only step that must be done by the account owner):
 *   Vercel → your project → Settings → Environment Variables →
 *   add  ANTHROPIC_API_KEY = <your key>  → redeploy.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "Method not allowed" } });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    // 503 → the app treats this as "no server examiner yet" and falls back to
    // the in-app key flow, so nothing crashes before the env var is added.
    res.status(503).json({
      error: {
        message:
          "The examiner is not configured on the server yet. Add ANTHROPIC_API_KEY " +
          "in your Vercel project's Environment Variables, then redeploy.",
      },
    });
    return;
  }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    // Light guard-rails so an open endpoint can't be abused into huge bills.
    if (!body || !/^claude-/.test(String(body.model || ""))) {
      res.status(400).json({ error: { message: "Invalid request." } });
      return;
    }
    body.max_tokens = Math.min(Number(body.max_tokens) || 3500, 4000);

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(502).json({ error: { message: "Upstream error: " + (e && e.message) } });
  }
}
