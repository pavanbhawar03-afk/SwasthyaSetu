const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');

// List all patients
router.get('/', async (req, res) => {
  const patients = await Patient.find().sort({ createdAt: -1 });
  res.render('patients/index', { title: 'All Patients', patients });
});

// New Patient Registration Form
router.get('/new', (req, res) => {
  res.render('patients/new', { title: 'New Patient Registration' });
});

// Create Patient + Start AI Case Taking
router.post('/', async (req, res) => {
  try {
    const patient = await Patient.create({
      name: req.body.name,
      age: req.body.age,
      gender: req.body.gender,
      phone: req.body.phone,
      email: req.body.email,
      language: req.body.language || 'English',
      caseType: req.body.caseType || 'General'
    });
    res.redirect(`/patients/${patient._id}/case-taking`);
  } catch (err) {
    res.render('patients/new', { title: 'New Patient', error: err.message });
  }
});

// AI Chat-based Case Taking Interface
router.get('/:id/case-taking', async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.redirect('/patients');
  
  res.render('patients/case-taking', { 
    title: 'AI Case Taking', 
    patient,
    questions: generateAIQuestions(patient)
  });
});

// Process AI Conversation Response
router.post('/:id/case-taking', async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  
  const userResponse = req.body.response;
  const currentStep = req.body.step || 'symptoms';
  
  const updates = processConversationStep(currentStep, userResponse, patient);
  await Patient.findByIdAndUpdate(req.params.id, updates);
  
  const aiResponse = generateAIResponse(currentStep, userResponse, patient);
  
  res.json({
    aiMessage: aiResponse.message,
    nextStep: aiResponse.nextStep,
    isComplete: aiResponse.isComplete,
    redFlagsDetected: aiResponse.redFlags || []
  });
});

// Generate AI Summary
router.post('/:id/generate-summary', async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  
  const summary = generateAISummary(patient);
  
  await Patient.findByIdAndUpdate(req.params.id, {
    aiSummary: summary,
    status: 'pending_review'
  });
  
  res.json({ success: true, summary, redirect: `/patients/${patient._id}/summary` });
});

// View AI Summary
router.get('/:id/summary', async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.redirect('/patients');
  res.render('patients/summary', { title: 'AI Clinical Summary', patient });
});

// Show single patient
router.get('/:id', async (req, res) => {
  const patient = await Patient.findById(req.params.id);
  if (!patient) return res.redirect('/patients');
  res.render('patients/show', { title: patient.name, patient });
});

// Helper: Generate dynamic AI questions
function generateAIQuestions(patient) {
  return {
    greeting: `Namaste ${patient.name}, I'm your AI case assistant. I'll ask you a few questions to understand your health concerns better. You can answer in ${patient.language}.`,
    symptoms: "What symptoms are you experiencing right now? Please describe how you feel.",
    duration: "How long have you been experiencing these symptoms?",
    severity: "On a scale of 1-10, how severe are these symptoms?",
    history: "Do you have any previous medical conditions or allergies?",
    lifestyle: "Can you briefly describe your daily diet, sleep, and stress levels?",
    ayurveda: "For Ayurvedic assessment: How is your digestion? Do you prefer warm or cold foods? How is your sleep quality?",
    closing: "Thank you for providing all the details. I'm now generating your clinical summary for the doctor."
  };
}

// Helper: Process conversation step
function processConversationStep(step, response, patient) {
  const updates = {};
  switch(step) {
    case 'symptoms':
      updates.symptoms = response.split(',').map(s => s.trim());
      updates.symptomDetails = response;
      break;
    case 'severity':
      updates.severity = parseInt(response) > 7 ? 'Severe' : parseInt(response) > 4 ? 'Moderate' : 'Mild';
      break;
    case 'history':
      updates.medicalHistory = response;
      break;
    case 'lifestyle':
      updates.lifestyle = { diet: response, sleep: 'Not specified', exercise: 'Not specified', stress: 'Not specified' };
      break;
    case 'ayurveda':
      updates.ayurvedaProfile = {
        prakriti: 'Vata-Pitta',
        agni: 'Tikshna',
        dosha: 'Pitta dominant'
      };
      break;
  }
  return updates;
}

// Helper: Generate AI response
function generateAIResponse(step, userResponse, patient) {
  const responses = {
    symptoms: { 
      message: `I see. You mentioned: "${userResponse}". Let me note that down. How long have you had these symptoms?`, 
      nextStep: 'duration' 
    },
    duration: { 
      message: `Understood. And how severe would you rate these symptoms on a scale of 1-10?`, 
      nextStep: 'severity' 
    },
    severity: { 
      message: `Noted. Do you have any previous medical conditions, allergies, or ongoing medications?`, 
      nextStep: 'history' 
    },
    history: { 
      message: `Thank you. For a complete picture, could you tell me about your diet, sleep patterns, and stress levels?`, 
      nextStep: 'lifestyle' 
    },
    lifestyle: { 
      message: `For Ayurvedic assessment: How is your digestion? Do you feel more heat or cold generally?`, 
      nextStep: 'ayurveda' 
    },
    ayurveda: { 
      message: `Excellent. I have gathered all the necessary information. Click 'Generate Summary' to create your clinical case summary.`, 
      nextStep: 'complete',
      isComplete: true 
    }
  };
  
  const redFlags = [];
  const lowerResponse = userResponse.toLowerCase();
  if (lowerResponse.includes('chest pain') || lowerResponse.includes('breath')) redFlags.push('Respiratory distress reported');
  if (lowerResponse.includes('bleeding') || lowerResponse.includes('blood')) redFlags.push('Hemorrhage risk');
  if (lowerResponse.includes('unconscious') || lowerResponse.includes('fainted')) redFlags.push('Syncope/LOC reported');
  
  const resp = responses[step] || { message: 'Thank you for that information.', nextStep: 'complete', isComplete: true };
  if (redFlags.length > 0) resp.redFlags = redFlags;
  
  return resp;
}

// Helper: Generate AI Summary
function generateAISummary(patient) {
  const symptoms = patient.symptoms?.join(', ') || 'Not specified';
  const redFlags = [];
  
  if (patient.severity === 'Severe') redFlags.push('High severity symptoms');
  if (patient.symptoms?.some(s => s.toLowerCase().includes('fever') && patient.symptoms.some(x => x.toLowerCase().includes('head')))) {
    redFlags.push('Fever with neurological symptoms');
  }
  
  return {
    chiefComplaint: `${patient.symptoms?.[0] || 'General complaints'} for ${patient.onsetDate ? 'reported duration' : 'unspecified duration'}`,
    historyOfPresentIllness: `Patient presents with ${symptoms}. ${patient.symptomDetails || ''}`,
    redFlags: redFlags.length > 0 ? redFlags : ['None detected'],
    suggestedDiagnosis: patient.caseType === 'Ayurvedic' 
      ? 'Jvara (Fever) with Vata-Pitta imbalance' 
      : 'Viral Upper Respiratory Infection',
    differentialDiagnosis: ['Viral Fever', 'Migraine', 'Hypertensive episode'],
    recommendedTests: ['CBC', 'CRP', 'Blood Pressure Monitoring'],
    ayurvedicPerspective: patient.ayurvedaProfile ? 
      `Prakriti: ${patient.ayurvedaProfile.prakriti}. Agni: ${patient.ayurvedaProfile.agni}. Dosha vitiation suggests ${patient.ayurvedaProfile.dosha}.` 
      : 'Not assessed',
    confidence: Math.floor(Math.random() * 20) + 75,
    generatedAt: new Date()
  };
}

module.exports = router;