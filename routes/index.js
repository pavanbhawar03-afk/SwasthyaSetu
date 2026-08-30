const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');

// Landing Page with Stats
router.get('/', async (req, res) => {
  const stats = {
    totalPatients: await Patient.countDocuments(),
    pendingReview: await Patient.countDocuments({ status: 'pending_review' }),
    redFlags: await Patient.countDocuments({ 
      'aiSummary.redFlags': { $exists: true, $not: { $size: 0 } } 
    })
  };
  res.render('index', { title: 'CASECARE AI', stats });
});

module.exports = router;