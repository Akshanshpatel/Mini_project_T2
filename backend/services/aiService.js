require('dotenv').config()

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment variables')
}

// Use current supported Gemini model
const GEMINI_MODEL_ID =
  process.env.GEMINI_MODEL?.trim()

const GEMINI_GENERATE_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent`

function buildPrompt(transcript) {
  const trimmed = (transcript || '').trim()

  return `
Explain this medical conversation in very simple terms for a patient.
Keep it short, clear, and easy to understand.

"""
${trimmed}
"""

Return ONLY valid JSON.

{
  "simplified": "",
  "summary": {
    "diagnosis": "",
    "medications": "",
    "dosage": "",
    "tests": "",
    "advice": ""
  }
}

Rules:
- Put simple explanation only inside "simplified"
- Keep explanation short
- Fill summary fields only if information is clearly available
- Otherwise return empty strings
`
}

async function callGeminiGenerateContent(promptText) {
  const res = await fetch(GEMINI_GENERATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 500,
      },
    }),
  })

  const raw = await res.text()

  if (!res.ok) {
    throw new Error(
      `Gemini request failed (${res.status}): ${raw}`
    )
  }

  let data

  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Gemini response was not valid JSON')
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()

  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  return text
}

function shouldRetry(err) {
  const message = err.message || ''

  // Do NOT retry auth/config errors
  if (/400|401|403/.test(message)) {
    return false
  }

  if (/API key|permission|unauthorized|invalid/i.test(message)) {
    return false
  }

  return true
}

async function withRetry(fn, retries = 2, delayMs = 1000) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err

      if (!shouldRetry(err) || attempt === retries) {
        break
      }

      const backoff = delayMs * (attempt + 1)

      await new Promise((resolve) =>
        setTimeout(resolve, backoff)
      )
    }
  }

  throw lastError
}

async function generateSummary(transcript) {
  try {
    const prompt = buildPrompt(transcript)

    const content = await withRetry(() =>
      callGeminiGenerateContent(prompt)
    )

    let jsonContent = content

    // Extract JSON safely
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      jsonContent = jsonMatch[0]
    }

    let parsed

    try {
      parsed = JSON.parse(jsonContent)
    } catch (err) {
      throw new Error(
        `Gemini response was not valid JSON: ${err.message}`
      )
    }

    return {
      simplified: parsed.simplified || '',
      summary: {
        diagnosis: parsed.summary?.diagnosis || '',
        medications: parsed.summary?.medications || '',
        dosage: parsed.summary?.dosage || '',
        tests: parsed.summary?.tests || '',
        advice: parsed.summary?.advice || '',
      },
    }
  } catch (err) {
    console.error('Error calling Gemini API:', err.message)
    throw err
  }
}

module.exports = {
  generateSummary,
}