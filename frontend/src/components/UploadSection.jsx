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
  const silenceTimeoutRef = useRef(null)
  const lastChunkRef = useRef('')

  const MIN_CONFIDENCE = 0.7
  const MIN_TRANSCRIPT_CHARS = 3
  const SILENCE_RESET_MS = 1500

  const normalizeTranscript = (text) => {
    const tokens = text.split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return ''

    const deduped = [tokens[0]]
    for (let i = 1; i < tokens.length; i += 1) {
      const current = tokens[i]
      const prev = tokens[i - 1]
      if (current.toLowerCase() !== prev.toLowerCase()) {
        deduped.push(current)
      }
    }

    return deduped.join(' ')
  }

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
        const result = event.results[i]
        const alternative = result[0]
        const rawTranscript = (alternative.transcript || '').trim()
        const confidence =
          typeof alternative.confidence === 'number'
            ? alternative.confidence
            : 1

        // eslint-disable-next-line no-console
        console.debug('Speech result:', {
          transcript: rawTranscript,
          confidence,
          isFinal: result.isFinal,
        })

        if (!rawTranscript) {
          continue
        }

        const cleanedTranscript = rawTranscript.replace(/[\s.,!?]/g, '')
        const isNoise = cleanedTranscript.length < MIN_TRANSCRIPT_CHARS

        if (confidence < MIN_CONFIDENCE || isNoise) {
          continue
        }

        if (result.isFinal) {
          finalTranscript += `${rawTranscript} `
        } else {
          interimTranscript += `${rawTranscript} `
        }
      }

      const trimmedFinal = finalTranscript.trim()
      const trimmedInterim = interimTranscript.trim()

      if (!trimmedFinal && !trimmedInterim) {
        // Nothing passed the confidence/noise filters
        return
      }

      const rawNextChunk = `${trimmedFinal} ${trimmedInterim}`.trim()
      const normalizedNextChunk = normalizeTranscript(rawNextChunk)

      // eslint-disable-next-line no-console
      console.debug('Accepted speech chunk:', normalizedNextChunk)

      if (!normalizedNextChunk || normalizedNextChunk === lastChunkRef.current) {
        // Either no meaningful text, or it's just a repeat of the last chunk
        return
      }

      lastChunkRef.current = normalizedNextChunk

      setLiveTranscript((prev) =>
        normalizeTranscript(`${prev} ${normalizedNextChunk}`.trim())
      )

      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }

      silenceTimeoutRef.current = setTimeout(() => {
        setLiveTranscript((prev) => prev.trim())
        if (recognitionRef.current) {
          recognitionRef.current.stop()
        }
      }, SILENCE_RESET_MS)
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
      setIsRecording(false)
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
    }
  }, [])

  const handleStartRecording = () => {
    setError('')
    setLiveTranscript('')
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }
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
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
    }
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

