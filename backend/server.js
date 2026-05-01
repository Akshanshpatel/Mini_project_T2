require('dotenv').config()

const express = require('express')
const cors = require('cors')

const processRoutes = require('./routes/processRoutes')

const app = express()

// CORS
app.use(cors())

// Middleware
app.use(express.json())

// Test route
app.get('/', (req, res) => {
  res.send('Backend running')
})

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// API routes
app.use('/api', processRoutes)

// Port
const PORT = process.env.PORT || 5000

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})