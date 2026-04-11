import { useState, useEffect, useRef } from 'react'
import { processTranscript } from '../services/api'

const STORAGE_TRANSCRIPT_KEY = 'patientAdvocate:liveTranscript'
const STORAGE_KEEP_KEY = 'patientAdvocate:keepTranscriptOnStart'
const STORAGE_SESSION_ID_KEY = 'patientAdvocate:sessionId'
const STORAGE_SEGMENT_ANCHORS_KEY = 'patientAdvocate:segmentAnchors'

/** New UUID for this visit (chunked AI will key requests by session). */
function createVisitSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `visit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function readStoredSessionId() {
  try {
    return sessionStorage.getItem(STORAGE_SESSION_ID_KEY)
  } catch {
    return null
  }
}

function writeStoredSessionId(id) {
  try {
    sessionStorage.setItem(STORAGE_SESSION_ID_KEY, id)
  } catch {
    // ignore
  }
}

/** One id per tab visit; persisted so refresh keeps the same “appointment”. */
function ensureStoredSessionId() {
  const existing = readStoredSessionId()
  if (existing) return existing
  const id = createVisitSessionId()
  writeStoredSessionId(id)
  return id
}

function readStoredSegmentAnchors() {
  try {
    const raw = sessionStorage.getItem(STORAGE_SEGMENT_ANCHORS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStoredSegmentAnchors(anchors) {
  try {
    if (!anchors.length) {
      sessionStorage.removeItem(STORAGE_SEGMENT_ANCHORS_KEY)
    } else {
      sessionStorage.setItem(
        STORAGE_SEGMENT_ANCHORS_KEY,
        JSON.stringify(anchors)
      )
    }
  } catch {
    // ignore
  }
}

function readStoredTranscript() {
  try {
    return sessionStorage.getItem(STORAGE_TRANSCRIPT_KEY) ?? ''
  } catch {
    return ''
  }
}

function writeStoredTranscript(value) {
  try {
    if (value) {
      sessionStorage.setItem(STORAGE_TRANSCRIPT_KEY, value)
    } else {
      sessionStorage.removeItem(STORAGE_TRANSCRIPT_KEY)
    }
  } catch {
    // Quota, private mode, or disabled storage — ignore
  }
}

function readStoredKeepTranscriptOnStart() {
  try {
    return sessionStorage.getItem(STORAGE_KEEP_KEY) === '1'
  } catch {
    return false
  }
}

function writeStoredKeepTranscriptOnStart(value) {
  try {
    sessionStorage.setItem(STORAGE_KEEP_KEY, value ? '1' : '0')
  } catch {
    // ignore
  }
}

export default function UploadSection({
  loading,
  setLoading,
  setTranscript,
  setSimplified,
  setSummary,
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState(() =>
    readStoredTranscript()
  )
  const [keepTranscriptOnStart, setKeepTranscriptOnStart] = useState(() =>
    readStoredKeepTranscriptOnStart()
  )
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)
  const sessionIdRef = useRef(ensureStoredSessionId())
  const segmentAnchorsRef = useRef(readStoredSegmentAnchors())
  /** User pressed Start and expects listening until Stop (drives auto-restart). */
  const wantRecordingRef = useRef(false)
  /**
   * `recognition.stop()` / cleanup often raises `onerror` with `aborted` — not a user failure.
   */
  const suppressAbortErrorRef = useRef(false)
  /** After a `network` error, ignore `onend` auto-restart until the user taps Start again. */
  const speechServiceFailedRef = useRef(false)
  /** Avoid spamming the same network toast when Chrome fires multiple errors quickly. */
  const lastNetworkErrorUiAtRef = useRef(0)

  const MIN_CONFIDENCE = 0.7
  const MIN_TRANSCRIPT_CHARS = 3

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
    writeStoredTranscript(liveTranscript)
  }, [liveTranscript])

  useEffect(() => {
    writeStoredKeepTranscriptOnStart(keepTranscriptOnStart)
  }, [keepTranscriptOnStart])

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
      let finalBatch = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (!result.isFinal) {
          continue
        }

        const alternative = result[0]
        const rawTranscript = (alternative.transcript || '').trim()
        const confidence =
          typeof alternative.confidence === 'number'
            ? alternative.confidence
            : 1

        // eslint-disable-next-line no-console
        console.debug('Speech result (final only):', {
          transcript: rawTranscript,
          confidence,
        })

        if (!rawTranscript) {
          continue
        }

        const cleanedTranscript = rawTranscript.replace(/[\s.,!?]/g, '')
        const isNoise = cleanedTranscript.length < MIN_TRANSCRIPT_CHARS

        if (confidence < MIN_CONFIDENCE || isNoise) {
          continue
        }

        finalBatch += `${rawTranscript} `
      }

      const piece = normalizeTranscript(finalBatch.trim())
      if (!piece) {
        return
      }

      // eslint-disable-next-line no-console
      console.debug('Appending final transcript:', piece)

      setLiveTranscript((prev) => {
        const prevTrim = prev.trimEnd()
        if (!prevTrim) {
          return piece
        }
        return normalizeTranscript(`${prevTrim} ${piece}`.trim())
      })
    }

    recognition.onerror = (event) => {
      const code = event.error
      // eslint-disable-next-line no-console
      console.error('Speech recognition error:', code)

      if (code === 'aborted' && suppressAbortErrorRef.current) {
        suppressAbortErrorRef.current = false
        return
      }

      if (code === 'aborted' && !wantRecordingRef.current) {
        return
      }

      if (code === 'no-speech' && wantRecordingRef.current) {
        return
      }

      if (code === 'network') {
        wantRecordingRef.current = false
        speechServiceFailedRef.current = true
        setIsRecording(false)

        const now = Date.now()
        if (now - lastNetworkErrorUiAtRef.current < 2500) {
          return
        }
        lastNetworkErrorUiAtRef.current = now

        if (typeof window !== 'undefined' && !window.isSecureContext) {
          setError(
            'Speech recognition needs a secure page. Use https:// or open the app as http://localhost. A plain http:// address with your Wi‑Fi IP is often blocked.'
          )
        } else if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setError('You appear to be offline. Reconnect, then tap Start again.')
        } else {
          setError(
            'Could not reach the speech service (Chrome sends audio to Google). Try another network, turn off VPN or a strict firewall, or type your notes below.'
          )
        }
        return
      }

      wantRecordingRef.current = false

      if (code === 'no-speech') {
        setError('No speech detected. Tap Start when you are ready to speak.')
      } else if (code === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.')
      } else if (code === 'audio-capture') {
        setError(
          'No microphone found or it is in use. Check your device and try again.'
        )
      } else if (code === 'service-not-allowed') {
        setError(
          'Speech recognition is not available (blocked or unsupported in this context).'
        )
      } else {
        setError(`Speech recognition error: ${code}`)
      }
      setIsRecording(false)
    }

    recognition.onend = () => {
      if (speechServiceFailedRef.current) {
        wantRecordingRef.current = false
        setIsRecording(false)
        return
      }
      if (wantRecordingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Speech recognition restart failed:', err)
          wantRecordingRef.current = false
          setIsRecording(false)
          setError('Listening stopped. Tap Start to record again.')
        }
        return
      }
      setIsRecording(false)
    }

    recognitionRef.current = recognition

    return () => {
      wantRecordingRef.current = false
      suppressAbortErrorRef.current = true
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch {
          // already stopped
        }
      }
    }
  }, [])

  const handleStartRecording = () => {
    setError('')
    speechServiceFailedRef.current = false
    lastNetworkErrorUiAtRef.current = 0

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError(
        'Speech recognition needs a secure page. Use https:// or http://localhost (opening via your PC’s LAN IP as http:// is often blocked).'
      )
      return
    }

    const prefixAfterStart = keepTranscriptOnStart
      ? (() => {
          const t = liveTranscript.trimEnd()
          return t ? `${t}\n\n` : ''
        })()
      : ''
    const charOffset = prefixAfterStart.length

    if (keepTranscriptOnStart) {
      setLiveTranscript((prev) => {
        const trimmed = prev.trimEnd()
        if (!trimmed) return ''
        return `${trimmed}\n\n`
      })
    } else {
      setLiveTranscript('')
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
        wantRecordingRef.current = true
        const prevAnchors = segmentAnchorsRef.current
        const nextAnchors = [
          ...prevAnchors,
          {
            segmentIndex: prevAnchors.length,
            charOffset,
            startedAt: Date.now(),
          },
        ]
        segmentAnchorsRef.current = nextAnchors
        writeStoredSegmentAnchors(nextAnchors)
        setIsRecording(true)
      } catch (err) {
        wantRecordingRef.current = false
        setError('Failed to start recording. Please try again.')
      }
    }
  }

  const handleStopRecording = () => {
    wantRecordingRef.current = false
    if (recognitionRef.current) {
      suppressAbortErrorRef.current = true
      try {
        recognitionRef.current.stop()
      } catch {
        // invalid state if already ended
      }
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

  const handleClearTranscript = () => {
    if (isRecording || loading) return
    setError('')
    setLiveTranscript('')
    const nextId = createVisitSessionId()
    sessionIdRef.current = nextId
    writeStoredSessionId(nextId)
    segmentAnchorsRef.current = []
    writeStoredSegmentAnchors([])
  }

  return (
    <section className="card">
      <h2 className="cardTitle">Record Audio</h2>

      <div className="visitOptions">
        <label className="checkboxLabel">
          <input
            type="checkbox"
            checked={keepTranscriptOnStart}
            onChange={(e) => setKeepTranscriptOnStart(e.target.checked)}
            disabled={isRecording || loading}
          />
          <span>
            Same visit — keep my transcript when I press Start (for breaks or
            when the doctor steps out)
          </span>
        </label>
      </div>

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
        <div className="transcriptHeader">
          <label htmlFor="liveTranscript" className="transcriptLabel">
            Live Transcript:
          </label>
          <button
            type="button"
            className="textLinkBtn"
            onClick={handleClearTranscript}
            disabled={!liveTranscript.trim() || isRecording || loading}
          >
            Clear transcript
          </button>
        </div>
        <textarea
          id="liveTranscript"
          className="transcriptTextarea"
          value={liveTranscript}
          onChange={(e) => setLiveTranscript(e.target.value)}
          placeholder="Transcript will appear here as you speak..."
          rows={6}
          disabled={loading}
        />
        <p className="mutedText saveHint">
          Auto-saved in this browser tab if you refresh (cleared when you close
          the tab).
        </p>
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

