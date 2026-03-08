const { GoogleGenerativeAI } = require('@google/generative-ai')

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'

function buildPrompt(transcript) {
  return `You are a medical assistant helping patients understand doctor appointments.

Given the transcript below:

1. Rewrite the conversation in very simple language.
2. Extract structured summary with:
   - diagnosis
   - medications
   - dosage
   - tests
   - advice

Respond strictly in this JSON format:

{
  "simplified": "...",
  "summary": {
    "diagnosis": "",
    "medications": "",
    "dosage": "",
    "tests": "",
    "advice": ""
  }
}

Transcript:
"""
${transcript}
"""

Return only valid JSON. No extra text.`
}

async function generateSummary(transcript) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL })

  const prompt = buildPrompt(transcript)

  const shouldRetry = (err) => {
    const status = err.statusCode || err.status
    const message = err.message || ''

    if (status && [400, 401, 403].includes(status)) {
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
    const result = await withRetry(() => model.generateContent(prompt))
    const response = await result.response
    const content = response.text().trim()

    if (!content) {
      throw new Error('Gemini response was empty')
    }

    // Try to extract JSON from response (in case there's extra text)
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

    if (err.message.includes('API key')) {
      throw new Error('Invalid or missing GEMINI_API_KEY')
    }
    throw err
  }
}

module.exports = {
  generateSummary,
}

