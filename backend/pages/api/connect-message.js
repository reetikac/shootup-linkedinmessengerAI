import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { recipient, sender } = req.body ?? {};
  if (!recipient || !sender) {
    return res.status(400).json({ error: "Missing recipient or sender" });
  }

  const firstname = (recipient.name ?? "").split(/\s+/)[0];

  const prompt = `You are writing a LinkedIn connection request that is professional, warm, and genuinely personal — not a template. One concise message that opens a door without overselling.

RECIPIENT:
Name: ${recipient.name}
Headline: ${recipient.headline ?? ""}
Company: ${recipient.company ?? ""}
About: ${recipient.about ?? ""}

SENDER:
Name: ${sender.name}
Role: ${sender.role}
Years of Experience: ${sender.yearsExp}
Key Achievements: ${sender.achievements}

Rules:
- Tone must be professional and warm — credible but approachable, never stiff or salesy
- Address them by first name (${firstname})
- Reference something SPECIFIC from their profile — their work, company, or something from their about section
- Connect it naturally to the sender's background without overselling
- Feel like a genuine human wrote it after actually reading their profile
- STRICTLY under 280 characters — count before responding
- No "I came across your profile", no "I'd love to pick your brain", no buzzwords, no hollow flattery
- Return ONLY valid JSON: { "message": "..." }`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0].text.trim();
    const jsonText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(jsonText);
    const message = parsed.message ?? "";

    return res.status(200).json({ message, charCount: message.length });
  } catch (err) {
    console.error("Connect API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
