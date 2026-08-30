const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Document = require('../models/Document');

// Doctor Dashboard - Overview
router.get('/', async (req, res) => {
  const stats = {
    totalCases: await Patient.countDocuments(),
    pendingReview: await Patient.countDocuments({ status: 'pending_review' }),
    reviewed: await Patient.countDocuments({ status: 'reviewed' }),
    redFlags: await Patient.countDocuments({ 
      status: 'pending_review',
      'aiSummary.redFlags': { $exists: true, $not: { $size: 0 } } 
    }),
    todayCases: await Patient.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
    })
  };
  
  const pendingPatients = await Patient.find({ status: 'pending_review' })
    .sort({ 'aiSummary.confidence': 1, createdAt: -1 })
    .limit(10);
    
  const recentDocuments = await Document.find({ processingStatus: 'completed' })
    .populate('patient', 'name')
    .sort({ createdAt: -1 })
    .limit(5);
  
  res.render('dashboard/index', { 
    title: 'Doctor Dashboard', 
    stats, 
    pendingPatients,
    recentDocuments
  });
});

// Review Patient Case
router.get('/review/:id', async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.redirect('/dashboard');
  
  const documents = await Document.find({ patient: patient._id });
  
  res.render('dashboard/review', { 
    title: 'Review Case', 
    patient,
    documents
  });
});

// Submit Doctor Validation
router.post('/review/:id', async (req, res) => {
  const { doctorDiagnosis, doctorNotes, validationStatus } = req.body;
  
  await Patient.findByIdAndUpdate(req.params.id, {
    doctorDiagnosis,
    doctorNotes,
    validatedBy: 'Dr. Demo Physician',
    validatedAt: new Date(),
    status: validationStatus || 'reviewed'
  });
  
  res.redirect('/dashboard?message=Case reviewed successfully');
});

// Red Flag Alerts Panel
router.get('/alerts', async (req, res) => {
  const alerts = await Patient.find({
    status: 'pending_review',
    $or: [
      { 'aiSummary.redFlags': { $exists: true, $not: { $size: 0 } } },
      { severity: 'Critical' },
      { severity: 'Severe' }
    ]
  }).sort({ createdAt: -1 });
  
  res.render('dashboard/alerts', { title: 'Red Flag Alerts', alerts });
});

// Patient Records (ABDM-style view)
router.get('/records', async (req, res) => {
  const patients = await Patient.find()
    .select('name age gender status aiSummary.chiefComplaint createdAt')
    .sort({ createdAt: -1 });
  res.render('dashboard/records', { title: 'Patient Records', patients });
});

// API: Get patient stats for charts
router.get('/api/stats', async (req, res) => {
  const dailyStats = await Patient.aggregate([
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 7 }
  ]);
  
  const caseTypes = await Patient.aggregate([
    { $group: { _id: "$caseType", count: { $sum: 1 } } }
  ]);
  
  res.json({ dailyStats, caseTypes });
});

module.exports = router;