require('dotenv').config()

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  throw new Error('Missing GEMINI_API_KEY in environment variables')
}

// Stable default model
const GEMINI_MODEL_ID =
  process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash'

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
`
}

async function callGeminiGenerateContent(promptText) {
  const response = await fetch(GEMINI_GENERATE_URL, {
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

  const raw = await response.text()

  if (!response.ok) {
    throw new Error(
      `Gemini request failed (${response.status}): ${raw}`
    )
  }

  let data

  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('Gemini response was not valid JSON')
  }

  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .join('')
    .trim()

  if (!text) {
    throw new Error('Gemini returned empty response')
  }

  return text
}

function shouldRetry(error) {
  const message = error.message || ''

  // Don't retry client/auth errors
  if (/400|401|403/.test(message)) {
    return false
  }

  if (/API key|invalid|unauthorized|permission/i.test(message)) {
    return false
  }

  return true
}

async function withRetry(fn, retries = 2, delayMs = 1000) {
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (!shouldRetry(error) || attempt === retries) {
        break
      }

      await new Promise((resolve) =>
        setTimeout(resolve, delayMs * (attempt + 1))
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

    const jsonMatch = content.match(/\{[\s\S]*\}/)

    const jsonContent = jsonMatch
      ? jsonMatch[0]
      : content

    const parsed = JSON.parse(jsonContent)

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
  } catch (error) {
    console.error('Gemini Error:', error.message)

    // Fallback response so app never crashes
    return {
      simplified:
        'AI summary temporarily unavailable.',
      summary: {
        diagnosis: '',
        medications: '',
        dosage: '',
        tests: '',
        advice: '',
      },
    }
  }
}

module.exports = {
  generateSummary,
}