function normalizeSummary(summary) {
  if (!summary) return null

  if (typeof summary === 'object') {
    return summary
  }

  if (typeof summary === 'string') {
    try {
      return JSON.parse(summary)
    } catch {
      return {
        diagnosis: summary,
      }
    }
  }

  return null
}

function asList(value) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|,/g)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return [String(value)]
}

function Field({ label, children }) {
  return (
    <div className="fieldRow">
      <div className="fieldLabel">{label}</div>
      <div className="fieldValue">{children}</div>
    </div>
  )
}

export default function ResultSection({
  transcript,
  simplified,
  summary,
}) {
  const normalized = normalizeSummary(summary)

  const diagnosis =
    normalized?.diagnosis ||
    normalized?.Diagnosis ||
    normalized?.dx ||
    ''

  const medications =
    normalized?.medications ||
    normalized?.Medications ||
    normalized?.rx ||
    []

  const dosage =
    normalized?.dosage ||
    normalized?.Dosage ||
    ''

  const tests =
    normalized?.tests ||
    normalized?.Tests ||
    []

  const advice =
    normalized?.advice ||
    normalized?.Advice ||
    ''

  const medicationItems = asList(medications)
  const testItems = asList(tests)

  return (
    <section className="resultsGrid">
      {/* Transcript */}
      <div className="card">
        <h2 className="cardTitle">Transcript</h2>

        <div className="contentBox">
          {transcript ? (
            <pre className="preText">{transcript}</pre>
          ) : (
            <p className="mutedText">
              No transcript available.
            </p>
          )}
        </div>
      </div>

      {/* Simplified */}
      <div className="card">
        <h2 className="cardTitle">
          Simplified Explanation
        </h2>

        <div className="contentBox">
          {simplified ? (
            <pre className="preText">{simplified}</pre>
          ) : (
            <p className="mutedText">
              No explanation available.
            </p>
          )}
        </div>
      </div>

      {/* Structured Summary */}
      <div className="card">
        <h2 className="cardTitle">
          Structured Summary
        </h2>

        <div className="contentBox">
          {normalized ? (
            <div className="fields">
              <Field label="Diagnosis">
                {diagnosis || '—'}
              </Field>

              <Field label="Medications">
                {medicationItems.length ? (
                  <ul className="list">
                    {medicationItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )}
              </Field>

              <Field label="Dosage">
                {dosage || '—'}
              </Field>

              <Field label="Tests">
                {testItems.length ? (
                  <ul className="list">
                    {testItems.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )}
              </Field>

              <Field label="Advice">
                {advice || '—'}
              </Field>
            </div>
          ) : (
            <p className="mutedText">
              No summary available.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}