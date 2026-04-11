const path = require('path')

const envPath = path.join(__dirname, '.env')
const examplePath = path.join(__dirname, '.env.example')

let envResult = require('dotenv').config({
  path: envPath,
  // If GEMINI_API_KEY is already set (even to ""), default dotenv skips the file.
  override: true,
})

if (envResult.error?.code === 'ENOENT') {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] backend/.env not found. Loading backend/.env.example only for this run — create backend/.env for your real API key (dotenv never reads .env.example by default).'
  )
  envResult = require('dotenv').config({
    path: examplePath,
    override: true,
  })
  if (envResult.error) {
    // eslint-disable-next-line no-console
    console.warn('[env] Could not load', examplePath, ':', envResult.error.message)
  }
} else if (envResult.error) {
  // eslint-disable-next-line no-console
  console.warn('[env] Could not load', envPath, ':', envResult.error.message)
} else {
  // eslint-disable-next-line no-console
  console.log('[env] Loaded', envPath)
}

const geminiKey = (process.env.GEMINI_API_KEY || '').trim()
// eslint-disable-next-line no-console
console.log(
  '[env] GEMINI_API_KEY:',
  geminiKey
    ? `set (length ${geminiKey.length}, not logged for security)`
    : 'missing or blank — add GEMINI_API_KEY=... to backend/.env'
)
if (!geminiKey && envResult.parsed) {
  // eslint-disable-next-line no-console
  console.warn(
    '[env] Variable names in .env:',
    Object.keys(envResult.parsed).join(', ') || '(none)'
  )
}

const express = require('express')
const cors = require('cors')

const processRoutes = require('./routes/processRoutes')

const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.send("Backend running");
});

app.use('/api', processRoutes)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${PORT}`)
})

