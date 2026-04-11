// Demo project: key inlined so the app runs without env setup.
const GEMINI_API_KEY =
  'AIzaSyDTgfy6-AnWLhjiRy1PNbCbK7qEODol0RU'

/**
 * `gemini-1.5-flash` is retired for this API (404 on v1 and v1beta).
 * Use a current model id — see https://ai.google.dev/gemini-api/docs/models
 */
const GEMINI_MODEL_ID =
  (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim()) ||
  'gemini-2.5-flash'

const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent`

function buildPrompt(transcript) {
  const trimmed = (transcript || '').trim()
  return `Explain this medical conversation in very simple terms for a patient. Keep it short and clear:

"""
${trimmed}
"""

Return ONLY valid JSON (one line per field value is fine, no markdown fences):
{"simplified":"","summary":{"diagnosis":"","medications":"","dosage":"","tests":"","advice":""}}

Rules: Put your short explanation only in "simplified" (a few sentences, no fluff). Fill summary from the visit if clear; otherwise empty strings.`
}

async function callGeminiGenerateContent(promptText) {
  const res = await fetch(GEMINI_GENERATE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
    }),
  })

  const raw = await res.text()
  if (!res.ok) {
    throw new Error(
      `Gemini request failed (${res.status}): ${raw.slice(0, 600)}`
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

  return text
}

async function generateSummary(transcript) {
  const prompt = buildPrompt(transcript)

  const shouldRetry = (err) => {
    const message = err.message || ''

    if (/Gemini request failed \((400|401|403)\)/.test(message)) {
      return false
    }

    if (/API key|permission|unauthorized|invalid/i.test(message)) {
      return false
    }

    return true
  }

  const withRetry = async (fn, { retries = 2, delayMs = 500 } = {}) => {
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
        await new Promise((resolve) => setTimeout(resolve, backoff))
      }
    }

    throw lastError
  }

  try {
    const content = await withRetry(() => callGeminiGenerateContent(prompt))

    if (!content) {
      throw new Error('Gemini response was empty')
    }

    let jsonContent = content
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      jsonContent = jsonMatch[0]
    }

    let parsed
    try {
      parsed = JSON.parse(jsonContent)
    } catch (err) {
      throw new Error(`Gemini response was not valid JSON: ${err.message}`)
    }

    const simplified = parsed.simplified || ''
    const summary = parsed.summary || {
      diagnosis: '',
      medications: '',
      dosage: '',
      tests: '',
      advice: '',
    }

    return { simplified, summary }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error calling Gemini API:', err)
    throw err
  }
}

module.exports = {
  generateSummary,
}
