const { generateSummary } = require('../services/aiService')

async function processAppointment(req, res) {
  try {
    const { transcript } = req.body

    if (!transcript || !transcript.trim()) {
      return res.status(400).json({
        error: 'Transcript is required.',
      })
    }

    const cleanedTranscript = transcript.trim()

    const result = await generateSummary(cleanedTranscript)

    if (!result || typeof result !== 'object') {
      throw new Error('Invalid response from AI service')
    }

    console.log('📦 CONTROLLER RECEIVED:', result)

    return res.status(200).json({
      transcript: cleanedTranscript,
      simplified: result.simplified,
      summary: result.summary,
    })
  } catch (err) {
    console.error('❌ PROCESS APPOINTMENT ERROR:', err)

    return res.status(500).json({
      error: err.message || 'Something went wrong',
    })
  }
}

module.exports = {
  processAppointment,
}