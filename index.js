const express = require('express');
const mongoose = require('mongoose');
const expressLayouts = require('express-ejs-layouts');
const methodOverride = require('method-override');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/casecare_db')
  .then(() => console.log('✅ MongoDB Connected: casecare_db'))
  .catch(err => {
    console.error('❌ MongoDB Connection Error:', err.message);
    console.log('⚠️  Make sure MongoDB is running (mongod)');
  });


app.use(express.urlencoded({ extended: true }));      // Form data parsing
app.use(express.json());                               // JSON API parsing
app.use(methodOverride('_method'));                    // PUT/DELETE support
app.use(express.static(path.join(__dirname, 'public'))); // Static assets


app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');


const indexRoutes = require('./routes/index');
const patientRoutes = require('./routes/patients');
const documentRoutes = require('./routes/documents');
const dashboardRoutes = require('./routes/dashboard');

app.use('/', indexRoutes);           // Landing + Home
app.use('/patients', patientRoutes); // Feature 1: AI Chat Case Taking
app.use('/documents', documentRoutes); // Feature 2: Upload + OCR
app.use('/dashboard', dashboardRoutes); // Feature 3: Doctor Review


app.get('/seed', async (req, res) => {
  try {
    const Patient = require('./models/Patient');
    const Document = require('./models/Document');

    await Patient.deleteMany({});
    await Document.deleteMany({});

    const demoPatient = await Patient.create({
      name: 'Rahul Sharma',
      age: 34,
      gender: 'Male',
      phone: '+91-9876543210',
      email: 'rahul@email.com',
      language: 'Hindi',
      caseType: 'General',
      symptoms: ['Fever', 'Headache', 'Fatigue'],
      medicalHistory: 'Hypertension since 2020',
      ayurvedaProfile: {
        prakriti: 'Pitta-Vata',
        dosha: 'Pitta dominant',
        agni: 'Tikshna'
      },
      aiSummary: {
        chiefComplaint: 'Fever with headache for 3 days',
        redFlags: ['Persistent high fever', 'Severe headache'],
        suggestedDiagnosis: 'Viral Fever / Migraine',
        differentialDiagnosis: ['Viral Fever', 'Migraine', 'Hypertensive episode'],
        recommendedTests: ['CBC', 'CRP', 'Blood Pressure Monitoring'],
        ayurvedicPerspective: 'Prakriti: Pitta-Vata. Agni: Tikshna. Pitta vitiation causing Jvara.',
        confidence: 78,
        generatedAt: new Date()
      },
      status: 'pending_review',
      createdAt: new Date()
    });

    await Document.create({
      patient: demoPatient._id,
      filename: 'blood_report_demo.pdf',
      originalName: 'Blood_Report_Aug2025.pdf',
      mimeType: 'application/pdf',
      size: 1024000,
      documentType: 'Lab Report',
      extractedData: {
        hemoglobin: '13.2 g/dL',
        wbc: '11,500 /cmm (High)',
        platelets: '2.8 lakhs',
        glucose: '98 mg/dL',
        creatinine: '0.9 mg/dL',
        notes: 'Elevated WBC count - suggestive of infection',
        dateOfReport: new Date('2025-08-20'),
        referredBy: 'Dr. A. Kumar'
      },
      ocrText: 'COMPLETE BLOOD COUNT\nDate: 2025-08-20\nHemoglobin: 13.2 g/dL\nWBC: 11,500 /cmm\nPlatelets: 2.8 lakhs\nNotes: Elevated WBC count - suggestive of infection',
      processingStatus: 'completed',
      autoFilledFields: ['Lab values noted in history'],
      createdAt: new Date()
    });

    res.send(`
      <div style="font-family:sans-serif;max-width:600px;margin:50px auto;text-align:center;">
        <h2 style="color:#0d7377;">✅ Demo Data Seeded Successfully!</h2>
        <p>1 Patient + 1 Document created.</p>
        <a href="/" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#0d7377;color:#fff;text-decoration:none;border-radius:8px;">Go to Home</a>
        <a href="/dashboard" style="display:inline-block;margin-top:20px;margin-left:10px;padding:12px 24px;background:#03256c;color:#fff;text-decoration:none;border-radius:8px;">Go to Dashboard</a>
      </div>
    `);
  } catch (err) {
    res.status(500).send('❌ Seed Error: ' + err.message);
  }
});

app.use((req, res) => {
  res.status(404).render('index', { 
    title: 'Page Not Found',
    stats: { totalPatients: 0, pendingReview: 0, redFlags: 0 }
  });
});


app.use((err, req, res, next) => {
  console.error('Server Error:', err.stack);
  res.status(500).send('❌ Something went wrong! Check console.');
});


app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     🏥 CASECARE AI - SIH26047           ║');
  console.log('║     Smart Case. Better Care.             ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  🚀 Server running: http://localhost:${PORT}  ║`);
  console.log('║                                          ║');
  console.log('║  📋 Available Routes:                    ║');
  console.log('║     • /          → Landing Page          ║');
  console.log('║     • /seed      → Seed Demo Data        ║');
  console.log('║     • /patients  → AI Case Taking        ║');
  console.log('║     • /documents → Upload & OCR          ║');
  console.log('║     • /dashboard → Doctor Review         ║');
  console.log('╚══════════════════════════════════════════╝');
});

module.exports = app;