// GET/POST /api/jarvis: Jarvis, LodgeNet's operations chief of staff (page at /jarvis).
// Reads Stripe and GitHub (never writes) and has Claude write the briefing and answer questions.
// Environment variables (Vercel -> Settings -> Environment Variables):
//   JARVIS_ACCESS_CODE  required; Jarvis stays locked until it is set
//   ANTHROPIC_API_KEY   Claude, for briefings and questions
//   JARVIS_STRIPE_KEY   a restricted, read-only Stripe key. Without it Jarvis uses the same key as
//                       billing: STRIPE_SECRET_KEY, or the one saved in the owner's hub
//   GITHUB_TOKEN        a fine-grained, read-only token for this repo
//   JARVIS_MODEL        optional, default claude-sonnet-5-5
import { createRequire } from "node:module";
import { companyConfig, handleJarvis } from "./_jarvis-core.mjs";

const require = createRequire(import.meta.url);
const COMPANY = {
  "id": "lodgenet",
  "name": "LodgeNet",
  "repo": "WinstonAIButler/lodgenet",
  "context": "LodgeNet gives Masonic lodges their own website, a merch store that funds their charities, a calendar for Stated Communications and fundraisers, and a Secretary's desk for meeting minutes. Plans are Starter, Lodge ($19 per month via Stripe) and District; some lodges are comped with plan codes. Buyers are lodge Secretaries and Worshipful Masters; growth runs through word of mouth between lodges, districts and Grand Lodges."
};

export default async function handler(req, res) {
  const env = { ...process.env };
  if (!env.JARVIS_STRIPE_KEY && !env.STRIPE_SECRET_KEY && req.method === "POST") {
    env.JARVIS_STRIPE_KEY = (await require("./_stripe").stripeKey().catch(() => null)) || "";
  }
  const out = await handleJarvis({ method: req.method, headers: req.headers, body: req.body }, companyConfig(env, COMPANY));
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = out.status;
  res.end(JSON.stringify(out.body));
}
