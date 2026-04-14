import { topGuesses } from "../../logics/emailConfidence.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, company } = req.body ?? {};
  if (!name || !company) {
    return res.status(400).json({ error: "Missing name or company" });
  }

  // ── Parse name ────────────────────────────────────────────────────────────
  const parts     = name.trim().split(/\s+/);
  const firstName = parts[0].toLowerCase().replace(/[^a-z]/g, "");
  const lastName  = parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, "");

  if (!firstName || !lastName) {
    return res.status(400).json({ error: "Could not parse name" });
  }

  // ── Infer domain ──────────────────────────────────────────────────────────
  const slug = company
    .trim()
    .replace(/\b(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Corporation|Co\.?|Holdings?)\b/gi, "")
    .replace(/\b(Technologies|Technology|Solutions|Services|Group|International|Consulting)\b/gi, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const domain = `${slug}.com`;

  // ── Top 3 guesses (scored by prevalence in emailConfidence.js) ────────────
  const guesses = topGuesses(firstName, lastName, domain);

  return res.status(200).json({ domain, guesses });
}
