const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3000
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

app.use(cors())
app.use(express.json())

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'VoiceDesk backend running' })
})

// ─── Generate social media post ──────────────────────────────────────────────
app.post('/generate-post', async (req, res) => {
  const { business, audience, offer, platform, slot, tone, theme } = req.body

  if (!business) {
    return res.status(400).json({ error: 'business field is required' })
  }

  const themeNote = theme ? `Today's theme: "${theme}".` : ''

  const prompt = `You write social media posts for local service businesses.

Business: ${business}
Audience: ${audience || 'local homeowners'}
Offer/CTA: ${offer || 'free estimate'}
Platform: ${platform || 'Facebook'}
Slot: ${slot || 'Morning post (7 AM)'}
Tone: ${tone || 'conversational and trustworthy'}
${themeNote}

Write ONE high-performing social media post for this slot. Structure it as:
1. A strong hook (first 1-2 lines that stop the scroll)
2. A short engaging body (3-5 lines)
3. A clear call to action

Rules:
- Match the platform style (LinkedIn = professional, TikTok/Instagram = casual/punchy, Facebook = conversational)
- No hashtag blocks — use 2-3 max, inline or at end
- Make the CTA specific (call, DM, comment, link in bio)
- Do not use generic filler phrases like "Are you looking for..."
- Keep it under 200 words
- Output ONLY the post text, nothing else. No labels, no preamble.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()

    if (data.error) {
      return res.status(500).json({ error: data.error.message })
    }

    const text = data.content?.[0]?.text?.trim()
    res.json({ post: text })

  } catch (err) {
    console.error('generate-post error:', err)
    res.status(500).json({ error: 'Failed to generate post' })
  }
})

// ─── Future routes go here ────────────────────────────────────────────────────
// app.post('/gmail-clean', ...)
// app.post('/proposal', ...)
// app.post('/meeting-mind', ...)

app.listen(PORT, () => {
  console.log(`VoiceDesk backend running on port ${PORT}`)
})
