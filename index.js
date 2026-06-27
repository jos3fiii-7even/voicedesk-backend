const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3000
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const FAL_API_KEY = process.env.FAL_API_KEY

app.use(cors({ origin: '*' }))
app.use(express.json())

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'VoiceDesk backend running' })
})

// ─── Generate social media post ───────────────────────────────────────────────
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
    if (data.error) return res.status(500).json({ error: data.error.message })
    const text = data.content?.[0]?.text?.trim()
    res.json({ post: text })

  } catch (err) {
    console.error('generate-post error:', err)
    res.status(500).json({ error: 'Failed to generate post' })
  }
})

// ─── Generate image ────────────────────────────────────────────────────────────
app.post('/generate-image', async (req, res) => {
  const { business, theme, platform, slot } = req.body

  if (!business) {
    return res.status(400).json({ error: 'business field is required' })
  }

  try {
    // Step 1: Use Claude to write a great image prompt
    const promptRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Write a short image generation prompt for a social media post image.

Business: ${business}
Theme: ${theme || 'professional service work'}
Platform: ${platform || 'Facebook'}
Time slot: ${slot || 'morning'}

Rules:
- Photorealistic style, professional photography look
- Show real workers, real job sites, or real results
- Bright, clean, confidence-inspiring
- No text overlays in the image
- Under 80 words
- Output ONLY the image prompt, nothing else`
        }]
      })
    })

    const promptData = await promptRes.json()
    if (promptData.error) return res.status(500).json({ error: promptData.error.message })

    const imagePrompt = promptData.content?.[0]?.text?.trim()

    // Step 2: Send to Fal.ai for image generation
    const falRes = await fetch('https://fal.run/fal-ai/flux-schnell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${FAL_API_KEY}`
      },
      body: JSON.stringify({
        prompt: imagePrompt,
        image_size: 'square_hd',
        num_images: 1,
        num_inference_steps: 4
      })
    })

    const falData = await falRes.json()

    if (!falData.images?.[0]?.url) {
      console.error('Fal error:', falData)
      return res.status(500).json({ error: 'Image generation failed' })
    }

    res.json({
      imageUrl: falData.images[0].url,
      imagePrompt
    })

  } catch (err) {
    console.error('generate-image error:', err)
    res.status(500).json({ error: 'Failed to generate image' })
  }
})

// ─── Generate video script ─────────────────────────────────────────────────────
app.post('/generate-video', async (req, res) => {
  const { business, audience, offer, theme, platform, postContent } = req.body

  if (!business) {
    return res.status(400).json({ error: 'business field is required' })
  }

  const prompt = `You create short-form video scripts for local service businesses to post on social media.

Business: ${business}
Audience: ${audience || 'local homeowners'}
Offer: ${offer || 'free estimate'}
Platform: ${platform || 'Instagram'}
Theme: ${theme || 'professional service'}
Post copy for reference: ${postContent || ''}

Write a 15-30 second video script with:
1. HOOK (0-3 sec): The opening visual and first spoken line
2. BODY (3-20 sec): 2-3 quick scenes showing the work/result
3. CTA (20-30 sec): Closing line and on-screen text

Also include:
- VOICEOVER: The full spoken script
- ON-SCREEN TEXT: What text appears on screen
- SHOT LIST: 3-4 specific shots to film (be specific, e.g. "close-up of technician checking refrigerant levels")
- AI VIDEO PROMPT: A single sentence to paste into Kling AI or Sora to generate a clip

Format clearly with these exact headers. Keep it practical and filmable by one person with a phone.`

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
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    })

    const data = await response.json()
    if (data.error) return res.status(500).json({ error: data.error.message })
    const script = data.content?.[0]?.text?.trim()
    res.json({ script })

  } catch (err) {
    console.error('generate-video error:', err)
    res.status(500).json({ error: 'Failed to generate video script' })
  }
})

// ─── Future routes ─────────────────────────────────────────────────────────────
// app.post('/gmail-clean', ...)
// app.post('/proposal', ...)

app.listen(PORT, () => {
  console.log(`VoiceDesk backend running on port ${PORT}`)
})
