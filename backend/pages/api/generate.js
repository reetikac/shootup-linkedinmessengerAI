import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { recipient, sender } = req.body;

  if (!recipient || !sender) {
    return res.status(400).json({ error: "Missing recipient or sender" });
  }

  const prompt = `Write a cold job application email. Do not make it sound like a cover letter. It should feel like a sharp, confident human wrote it after spending 10 minutes researching the company and the person.

RECIPIENT:
Name: ${recipient.name}
Headline: ${recipient.headline}
Company: ${recipient.company}
About: ${recipient.about}

SENDER:
Name: ${sender.name}
Current Role: ${sender.role}
Key Achievements: ${sender.achievements}
Intent: ${sender.intent}
${sender.resumeBase64 ? "Resume: [attached as PDF above]" : ""}

Use this structure exactly:

Subject: conversational, lowercase feel, includes the company name, ends with one relevant emoji. Pattern: "Would love to be a [target role] at [company] [emoji]" — infer the target role from sender background and recipient's company context.

Body:
- Hey [recipient first name],
- 1 sentence: who the sender is + one specific, genuine observation about what this company/person is building. Pull from their LinkedIn about section or headline. Never say "I love what you're building" without saying WHAT specifically.
- 1 transition sentence on why it's a fit
- 3–4 bullet points. Each bullet written as "Label: one proof point with real numbers/outcomes. One sentence on why this is relevant to this specific company." Use details from the attached resume where available.
- 1 soft CTA — offer a call, keep it low pressure
- Sign off: just sender's first name

Rules:
- Tone: confident, warm, direct. Not arrogant, not sycophantic.
- Body length: 150–220 words
- No filler: "I hope this email finds you well", "I am writing to express my interest", "I believe I would be a great fit"
- Pick only the 3 most relevant proof points from the resume for THIS role and company
- Opening observation must be specific — never generic praise
${sender.resumeBase64 ? "- Draw heavily on the attached resume for specific achievements, metrics, tools, and projects" : ""}

Return ONLY valid JSON: { "subject": "...", "message": "..." }
The message value must be plain text only — no markdown symbols. Use • for bullet points.`;

  // Build the content array — prepend the PDF document if a resume was provided
  const content = [];

  if (sender.resumeBase64) {
    content.push({
      type: "document",
      source: {
        type: "base64",
        media_type: "application/pdf",
        data: sender.resumeBase64,
      },
    });
  }

  content.push({ type: "text", text: prompt });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content }],
    });

    const rawText = message.content[0].text.trim();

    // Strip markdown code fences if present
    const jsonText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    const parsed = JSON.parse(jsonText);

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
