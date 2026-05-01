const OpenAI = require('openai')
require('dotenv').config({ path: './backend/.env' })

const GROQ_API_KEY = process.env.GROQ_API_KEY

async function testGroq() {
  console.log('Testing Groq with key:', GROQ_API_KEY ? 'Present' : 'Missing')
  if (!GROQ_API_KEY) return

  const client = new OpenAI({
    apiKey: GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
  })

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'Return ONLY valid JSON.',
        },
        {
          role: 'user',
          content: 'Say hello in JSON format with a "message" key.',
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    })

    console.log('Response:', JSON.stringify(response, null, 2))
  } catch (error) {
    console.error('Error:', error)
  }
}

testGroq()
