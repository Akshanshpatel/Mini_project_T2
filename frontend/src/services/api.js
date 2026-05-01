import axios from 'axios'

const API_BASE_URL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://mini-project-t2-1.onrender.com'

export const processTranscript = async (
  transcript
) => {
  if (!transcript || !transcript.trim()) {
    throw new Error('Transcript is required.')
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/process`,
      {
        transcript: transcript.trim(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data
  } catch (error) {
    console.error(
      'API Error:',
      error?.response?.data || error.message
    )

    throw new Error(
      error?.response?.data?.error ||
        'Failed to process transcript.'
    )
  }
}