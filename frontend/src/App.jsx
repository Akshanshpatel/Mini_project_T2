import { useState } from 'react'
import UploadSection from './components/UploadSection.jsx'
import ResultSection from './components/ResultSection.jsx'

export default function App() {
  const [transcript, setTranscript] = useState('')
  const [simplified, setSimplified] = useState('')
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="container">
      <h1 className="title">AI Appointment Summarizer</h1>
      <p className="subtle">
        Record your appointment conversation to generate a transcript, a plain
        explanation, and a structured medical summary.
      </p>

      <UploadSection
        loading={loading}
        setLoading={setLoading}
        setTranscript={setTranscript}
        setSimplified={setSimplified}
        setSummary={setSummary}
      />

      <ResultSection
        transcript={transcript}
        simplified={simplified}
        summary={summary}
      />
    </div>
  )
}
