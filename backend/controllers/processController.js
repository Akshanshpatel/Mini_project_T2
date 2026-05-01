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

    const { simplified, summary } =
      await generateSummary(cleanedTranscript)

    return res.status(200).json({
      transcript: cleanedTranscript,
      simplified,
      summary,
    })
  } catch (err) {
    console.error('Error processing appointment:', err.message)

    // Prevent app crash during Gemini quota issues
    return res.status(200).json({
      transcript: req.body?.transcript || '',
      simplified:
        'AI summary temporarily unavailable.',
      summary: {
        diagnosis: '',
        medications: '',
        dosage: '',
        tests: '',
        advice: '',
      },
      error: err.message,
    })
  }
}

module.exports = {
  processAppointment,
}