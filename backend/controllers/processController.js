const { generateSummary } = require('../services/aiService')

async function processAppointment(req, res) {
  const { transcript } = req.body

  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'Transcript is required.' })
  }

  try {
    const { simplified, summary } = await generateSummary(transcript.trim())

    return res.json({
      transcript: transcript.trim(),
      simplified,
      summary,
    })
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error processing appointment:', err)

    const status = err.statusCode || err.status || 500
    const message = err.message || 'Failed to process transcript.'

    return res.status(status).json({
      error: message,
    })
  }
}

module.exports = {
  processAppointment,
}

