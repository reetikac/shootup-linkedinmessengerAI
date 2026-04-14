# Message Generation Logic

## 1. Email Logic

### Goal
Write a cold job application email that feels human, specific, and confident — not templated.

### Structure
**Subject:** Would love to be a [target role] at [company] + one relevant emoji

**Body:**
1. **Opening line** — "Hey [first name]," then 1 sentence: who the sender is + a specific, genuine observation about what the company is building. Not generic praise. Reference something real from their LinkedIn or company description.

2. **Transition line** — One punchy sentence on why the sender thinks it's a fit. Sets up the bullets.

3. **3–4 bullet points** — Each bullet must:
   - Start with a bold label (the "what", e.g. "AI-native builder")
   - Follow with 2 sentences max: one proof point, one relevance to this company/role
   - Use real numbers, real outcomes, real tools where available from the resume
   - Never be generic. Each bullet should feel written for THIS company

4. **Closing** — One soft CTA: offer a call, keep it low pressure. Sign off with just first name.

### Rules
- Tone: confident but not arrogant, warm but not sycophantic
- Length: 150–220 words for body
- No filler phrases: "I hope this email finds you well", "I am writing to express my interest", "I believe I would be a great fit"
- Do not list every job from resume — pick the 3 most relevant proof points for THIS role and company
- The opening observation about the company must be specific. Pull from: their LinkedIn about section, headline, recent post, or company description. Never say "I love what you're building" without saying WHAT specifically.
- Subject line: lowercase feel, conversational, includes company name, ends with one relevant emoji

### Inputs used
- Sender: name, resume (role titles, achievements, tools, metrics)
- Sender: target job title
- Recipient: name, headline, company name, about section from LinkedIn

### Prompt instruction to Claude
```
Write a cold job application email. Do not make it sound like a cover letter.
It should feel like a sharp, confident human wrote it after spending 10 minutes 
researching the company.

Use this structure exactly:
- Subject: conversational, includes company name, one emoji
- Hey [first name],
- 1 sentence: who the sender is + one specific real observation about what this 
  company/person is building (pull from their LinkedIn about or headline)
- 1 transition sentence setting up why it's a fit
- 3-4 bullets: bold label + proof point + relevance to this company. 
  Use real numbers from resume where available.
- 1 soft CTA line
- Sign off: just first name

Tone: confident, warm, direct. No corporate filler. Under 220 words.
Output plain text only, no markdown.
```

---

## 2. LinkedIn Connection Message Logic

### Goal
Write a short connection request note that gets accepted. It should feel personal, not like a mass outreach blast.

### Structure
- **No subject line** (LinkedIn connection notes have no subject)
- 3 sentences max, sometimes 2 is better
- Line 1: specific reason you're reaching out tied to THEIR work (not yours)
- Line 2: one sentence on who you are — only the most relevant thing
- Line 3 (optional): soft, no-pressure CTA or just a genuine closer

### Rules
- Character limit: under 300 characters (LinkedIn hard limit for connection notes)
- Never start with "Hi, I came across your profile" — too generic
- Never ask for a job directly in the connection note
- Reference something real: their company, their role, a project, their post
- Tone: curious and genuine, not salesy
- No emojis in connection notes (looks unprofessional in this context)
- End with no CTA or a very soft one — the goal is just to get accepted

### Examples of good vs bad

**Bad:**
> Hi Rohan, I came across your profile and would love to connect. I'm a PM looking for new opportunities and think I could add value to your team.

**Good:**
> Rohan, building conversational AI that actually remembers context is a hard problem. I'm a PM who's been working on similar memory + personalization problems. Would love to be in your network.

### Inputs used
- Sender: name, current role, one most relevant achievement or focus area
- Recipient: name, headline, company, about section

### Prompt instruction to Claude
```
Write a LinkedIn connection request note. Hard limit: 280 characters.

Rules:
- Line 1: reference something specific about what THEY are building or doing 
  (from their headline or about). Make it feel like you actually looked at 
  their profile.
- Line 2: one sentence on who the sender is — most relevant thing only.
- Optional line 3: soft closer or genuine observation. No ask.
- No "I came across your profile"
- No asking for a job or call
- No emojis
- Tone: direct, genuine, peer-to-peer

Output plain text only. Must be under 280 characters.
```