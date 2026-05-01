require('dotenv').config()

const Groq = require('groq-sdk')

const GROQ_API_KEY = process.env.GROQ_API_KEY

if (!GROQ_API_KEY) {
  throw new Error('Missing GROQ_API_KEY in environment variables')
}

console.log(`🔑 GROQ API KEY LOADED: ${GROQ_API_KEY.slice(0, 4)}...${GROQ_API_KEY.slice(-4)}`)

const client = new Groq({
  apiKey: GROQ_API_KEY,
})

function buildPrompt(transcript) {
  return `
Explain this medical conversation in very simple terms for a patient.

Keep it short, clear, and easy to understand.

"""
${transcript}
"""

Return ONLY valid JSON in this format:

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

async function generateSummary(transcript) {
  try {
    console.log('🚀 GENERATING SUMMARY FOR TRANSCRIPT LENGTH:', transcript.length)
    
    const prompt = buildPrompt(transcript)

    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a medical assistant. Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 1024,
    })

    console.log('🔍 FULL GROQ RESPONSE:', JSON.stringify(response, null, 2))

    const text = response?.choices?.[0]?.message?.content

    if (!text) {
      console.error('❌ GROQ RETURNED EMPTY CONTENT')
      throw new Error('No content returned from Groq')
    }

    console.log('🧠 MODEL OUTPUT:', text)

    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (parseError) {
      console.warn('⚠️ JSON.parse failed on direct text, trying regex match...')
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Model did not return valid JSON:\n' + text)
      }
      parsed = JSON.parse(jsonMatch[0])
    }

    console.log('✅ FINAL PARSED OUTPUT:', parsed)

    return {
      simplified: parsed.simplified || parsed.simplifiedExplanation || 'Explanation unavailable.',
      summary: parsed.summary || parsed.structuredSummary || { diagnosis: 'Unavailable' },
    }
  } catch (error) {
    console.error('❌ GROQ FAILURE:', error.message)

    // Fallback to Gemini if Groq fails
    if (process.env.GEMINI_API_KEY) {
      console.log('🔄 FALLING BACK TO GEMINI...')
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai')
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-2.0-flash' })

        const prompt = buildPrompt(transcript)
        const result = await model.generateContent(prompt)
        const text = result.response.text()

        console.log('🧠 GEMINI OUTPUT:', text)

        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('Gemini did not return valid JSON')
        
        const parsed = JSON.parse(jsonMatch[0])
        return {
          simplified: parsed.simplified || parsed.simplifiedExplanation || 'Explanation unavailable.',
          summary: parsed.summary || parsed.structuredSummary || { diagnosis: 'Unavailable' },
        }
      } catch (geminiError) {
        console.error('❌ GEMINI FALLBACK ALSO FAILED:', geminiError.message)
      }
    }

    if (error.status === 401 || error.message.includes('401')) {
      throw new Error('Invalid Groq API Key. Please check your .env file or use Gemini.')
    }
    throw error
  }
}

module.exports = {
  generateSummary,
}