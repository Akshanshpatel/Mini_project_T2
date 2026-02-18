import axios from 'axios'

const API_BASE_URL = 'http://localhost:5000'

export const processTranscript = async (transcript) => {
  if (!transcript || !transcript.trim()) {
    throw new Error('Transcript is required.')
  }

  const res = await axios.post(
    `${API_BASE_URL}/api/process`,
    { transcript: transcript.trim() },
    {
      headers: { 'Content-Type': 'application/json' },
    }
  )

  return res.data
}

