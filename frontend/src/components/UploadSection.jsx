import { useState, useEffect, useRef } from 'react'
import { processTranscript } from '../services/api'

export default function UploadSection({
  loading,
  setLoading,
  setTranscript,
  setSimplified,
  setSummary,
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError(
        'Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.'
      )
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      setLiveTranscript((prev) => {
        const currentFinal = prev.split('\n').pop() || ''
        return (
          prev.replace(/\n[^\n]*$/, '') +
          '\n' +
          (currentFinal + finalTranscript).trim() +
          interimTranscript
        )
      })
    }

    recognition.onerror = (event) => {
      // eslint-disable-next-line no-console
      console.error('Speech recognition error:', event.error)
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.')
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.')
      } else {
        setError(`Speech recognition error: ${event.error}`)
      }
      setIsRecording(false)
    }

    recognition.onend = () => {
      if (isRecording) {
        recognition.start()
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isRecording])

  const handleStartRecording = () => {
    setError('')
    setLiveTranscript('')
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
        setIsRecording(true)
      } catch (err) {
        setError('Failed to start recording. Please try again.')
      }
    }
  }

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleSendTranscript = async () => {
    const transcriptText = liveTranscript.trim()

    if (!transcriptText) {
      setError('Please record some speech before sending.')
      return
    }

    setError('')
    setLoading(true)
    setTranscript('')
    setSimplified('')
    setSummary(null)

    try {
      const data = await processTranscript(transcriptText)
      setTranscript(data?.transcript ?? transcriptText)
      setSimplified(data?.simplified ?? data?.simplifiedExplanation ?? '')
      setSummary(data?.summary ?? data?.structuredSummary ?? null)
    } catch (err) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to process transcript.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition

  if (!SpeechRecognition) {
    return (
      <section className="card">
        <h2 className="cardTitle">Record Audio</h2>
        <p className="errorText" role="alert">
          Web Speech API is not supported in this browser. Please use Chrome,
          Edge, or Safari.
        </p>
      </section>
    )
  }

  return (
    <section className="card">
      <h2 className="cardTitle">Record Audio</h2>

      <div className="recordingControls">
        <button
          className={`recordBtn ${isRecording ? 'recording' : ''}`}
          type="button"
          onClick={handleStartRecording}
          disabled={isRecording || loading}
        >
          {isRecording ? 'Recording…' : 'Start Recording'}
        </button>

        <button
          className="stopBtn"
          type="button"
          onClick={handleStopRecording}
          disabled={!isRecording || loading}
        >
          Stop Recording
        </button>

        <button
          className="primaryBtn"
          type="button"
          onClick={handleSendTranscript}
          disabled={!liveTranscript.trim() || loading || isRecording}
        >
          {loading ? 'Processing…' : 'Send Transcript'}
        </button>
      </div>

      <div className="transcriptArea">
        <label htmlFor="liveTranscript" className="transcriptLabel">
          Live Transcript:
        </label>
        <textarea
          id="liveTranscript"
          className="transcriptTextarea"
          value={liveTranscript}
          onChange={(e) => setLiveTranscript(e.target.value)}
          placeholder="Transcript will appear here as you speak..."
          rows={6}
          disabled={loading}
        />
      </div>

      {loading ? (
        <p className="mutedText" role="status" aria-live="polite">
          Processing transcript. This may take a moment…
        </p>
      ) : null}

      {error ? (
        <p className="errorText" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}

