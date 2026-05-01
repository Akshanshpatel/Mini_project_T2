const express = require('express')

const {
  processAppointment,
} = require('../controllers/processController')

const router = express.Router()

// POST /api/process
router.post('/process', processAppointment)

module.exports = router