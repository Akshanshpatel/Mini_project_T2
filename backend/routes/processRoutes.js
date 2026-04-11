const express = require('express')
const { processAppointment } = require('../controllers/processController')

const router = express.Router()

router.post('/process', processAppointment)

module.exports = router

