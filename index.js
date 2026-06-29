const express = require('express')
const cors = require('cors')

const app = express()
const PORT = process.env.PORT || 3000
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const FAL_API_KEY = process.env.FAL_API_KEY
const BLOTATO_API_KEY = process.env.BLOTATO_API_KEY

app.use(cors({ origin: '*' }))
app.use(express.json())

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'VoiceDesk backend running' })
})

// ─── Generate social media post ───────────────────────────────────────────────
app.post('/generate-post', async (req, res) => {
  const { business, audience, offer, platform, slot, tone, theme } = req.body
  if (!business) return res.status(400).json({ error: 'business field is required' })

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
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 400, messages: [{ role: 'user', content: prompt }] })
    })
    const data = await response.json()
    if (data.error) return res.status(500).json({ error: data.error.message })
    res.json({ post: data.content?.[0]?.text?.trim() })
  } catch (err) {
    console.error('generate-post error:', err)
    res.status(500).json({ error: 'Failed to generate post' })
  }
})

// ─── Generate image ────────────────────────────────────────────────────────────
app.post('/generate-image', async (req, res) => {
  const { business, theme, platform, slot } = req.body
  if (!business) return res.status(400).json({ error: 'business field is required' })

  try {
    const promptRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Write a short image generation prompt for a social media post.
Business: ${business}
Theme: ${theme || 'professional service work'}
Platform: ${platform || 'Facebook'}

Rules: photorealistic, professional photography, real workers or job results, bright and clean, no text in image. Under 60 words. Output ONLY the prompt.`
        }]
      })
    })
    const promptData = await promptRes.json()
    if (promptData.error) return res.status(500).json({ error: promptData.error.message })
    const imagePrompt = promptData.content?.[0]?.text?.trim()
    console.log('Image prompt:', imagePrompt)

    const falRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Key ${FAL_API_KEY}` },
      body: JSON.stringify({ prompt: imagePrompt, image_size: 'square_hd', num_images: 1, num_inference_steps: 4, sync_mode: true })
    })

    const falText = await falRes.text()
    console.log('Fal status:', falRes.status)
    console.log('Fal response:', falText.slice(0, 500))

    const falData = JSON.parse(falText)
    if (!falData.images?.[0]?.url) {
      return res.status(500).json({ error: falData.detail || falData.message || 'No image returned from Fal' })
    }

    res.json({ imageUrl: falData.images[0].url, imagePrompt })
  } catch (err) {
    console.error('generate-image error:', err)
    res.status(500).json({ error: 'Failed to generate image: ' + err.message })
  }
})

// ─── Generate video script ─────────────────────────────────────────────────────
app.post('/generate-video', async (req, res) => {
  const { business, audience, offer, theme, platform, postContent } = req.body
  if (!business) return res.status(400).json({ error: 'business field is required' })

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
- SHOT LIST: 3-4 specific shots to film
- AI VIDEO PROMPT: A single sentence to paste into Kling AI or Sora

Format clearly with these exact headers. Keep it practical and filmable by one person with a phone.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 600, messages: [{ role: 'user', content: prompt }] })
    })
    const data = await response.json()
    if (data.error) return res.status(500).json({ error: data.error.message })
    res.json({ script: data.content?.[0]?.text?.trim() })
  } catch (err) {
    console.error('generate-video error:', err)
    res.status(500).json({ error: 'Failed to generate video script' })
  }
})

// ─── Get Blotato accounts ──────────────────────────────────────────────────────
app.get('/blotato-accounts', async (req, res) => {
  try {
    const response = await fetch('https://backend.blotato.com/v2/users/me/accounts', {
      headers: { 'blotato-api-key': BLOTATO_API_KEY }
    })
    const data = await response.json()
    console.log('Blotato accounts:', JSON.stringify(data).slice(0, 500))
    res.json(data)
  } catch (err) {
    console.error('blotato-accounts error:', err)
    res.status(500).json({ error: 'Failed to fetch Blotato accounts' })
  }
})

// ─── Publish post via Blotato ──────────────────────────────────────────────────
app.post('/publish-post', async (req, res) => {
  const { accountId, text, imageUrl, platform, pageId, scheduleTime } = req.body
  if (!accountId || !text || !platform) {
    return res.status(400).json({ error: 'accountId, text, and platform are required' })
  }

  const platformMap = {
    'Facebook': 'facebook',
    'Instagram': 'instagram',
    'LinkedIn': 'linkedin',
    'TikTok': 'tiktok',
    'X / Twitter': 'twitter'
  }
  const plat = platformMap[platform] || platform.toLowerCase()

  const content = {
    text,
    mediaUrls: imageUrl ? [imageUrl] : [],
    platform: plat
  }

  const target = { targetType: plat }
  if (pageId) target.pageId = pageId

  const body = { post: { accountId, content, target } }

  if (scheduleTime) {
    body.scheduledTime = scheduleTime
  } else {
    body.useNextFreeSlot = true
  }

  try {
    const response = await fetch('https://backend.blotato.com/v2/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'blotato-api-key': BLOTATO_API_KEY },
      body: JSON.stringify(body)
    })
    const data = await response.json()
    console.log('Blotato publish response:', JSON.stringify(data).slice(0, 500))
    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Blotato publish failed', details: data })
    }
    res.json({ success: true, postSubmissionId: data.postSubmissionId, data })
  } catch (err) {
    console.error('publish-post error:', err)
    res.status(500).json({ error: 'Failed to publish post: ' + err.message })
  }
})

app.listen(PORT, () => console.log(`VoiceDesk backend running on port ${PORT}`))
