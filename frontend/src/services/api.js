import axios from 'axios'

const API_BASE_URL = 'https://mini-project-t2-1.onrender.com/'

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

