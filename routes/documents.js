const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Patient = require('../models/Patient');
const Document = require('../models/Document');

// Multer Storage Config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error('Only images and documents are allowed'));
  }
});

// Document Upload Page
router.get('/upload/:patientId', async (req, res) => {
  const patient = await Patient.findById(req.params.patientId);
  if (!patient) return res.redirect('/patients');
  res.render('documents/upload', { title: 'Upload Medical Document', patient });
});

// Handle Document Upload + Simulated OCR
router.post('/upload/:patientId', upload.single('medicalDocument'), async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    
    const doc = await Document.create({
      patient: patient._id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      documentType: req.body.documentType || 'Other',
      processingStatus: 'processing'
    });
    
    setTimeout(async () => {
      await simulateOCR(doc, patient, req.body.documentType);
    }, 2000);
    
    res.json({
      success: true,
      document: doc,
      message: 'Document uploaded successfully! OCR processing started...',
      redirect: `/documents/${doc._id}/results`
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// View OCR Results & Auto-fill
router.get('/:id/results', async (req, res) => {
  const doc = await Document.findById(req.params.id).populate('patient');
  if (!doc) return res.redirect('/patients');
  res.render('documents/results', { title: 'OCR Results', document: doc });
});

// Apply Auto-fill to Patient Record
router.post('/:id/autofill', async (req, res) => {
  const doc = await Document.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  
  const updateData = {};
  const autoFilled = [];
  
  if (doc.extractedData.hemoglobin) {
    autoFilled.push('Lab values noted in history');
  }
  if (doc.extractedData.medicines && doc.extractedData.medicines.length > 0) {
    updateData.currentMedications = doc.extractedData.medicines;
    autoFilled.push('Current medications updated');
  }
  if (doc.extractedData.dateOfReport) {
    autoFilled.push('Report date recorded');
  }
  
  await Patient.findByIdAndUpdate(doc.patient, updateData);
  
  await Document.findByIdAndUpdate(req.params.id, {
    autoFilledFields: autoFilled,
    processingStatus: 'completed'
  });
  
  res.json({ success: true, autoFilled, message: 'Patient record updated with extracted data!' });
});

// List all documents for a patient
router.get('/patient/:patientId', async (req, res) => {
  const patient = await Patient.findById(req.params.patientId);
  const documents = await Document.find({ patient: req.params.patientId }).sort({ createdAt: -1 });
  res.render('documents/list', { title: 'Patient Documents', patient, documents });
});

// Simulated OCR Engine
async function simulateOCR(doc, patient, docType) {
  const simulatedData = {
    'Lab Report': {
      ocrText: `COMPLETE BLOOD COUNT\nDate: 2025-08-20\nHemoglobin: 13.2 g/dL [Normal: 13.5-17.5]\nWBC: 11,500 /cmm [Normal: 4,000-11,000]\nRBC: 4.8 million/cmm\nPlatelets: 2.8 lakhs/cmm\nGlucose (Fasting): 98 mg/dL\nCreatinine: 0.9 mg/dL\nNotes: Elevated WBC count - suggestive of infection`,
      extractedData: {
        hemoglobin: '13.2 g/dL',
        wbc: '11,500 /cmm (High)',
        rbc: '4.8 million/cmm',
        platelets: '2.8 lakhs/cmm',
        glucose: '98 mg/dL',
        creatinine: '0.9 mg/dL',
        notes: 'Elevated WBC count - suggestive of infection',
        dateOfReport: new Date('2025-08-20'),
        referredBy: 'Dr. A. Kumar'
      }
    },
    'Prescription': {
      ocrText: `PRESCRIPTION\nDr. S. Patel, MD\nPatient: ${patient.name}\nDate: 2025-08-25\n\n1. Paracetamol 500mg - 1 tab TDS x 5 days\n2. Azithromycin 500mg - 1 tab OD x 3 days\n3. Vitamin C 500mg - 1 tab OD x 10 days\n\nAdvice: Take rest, drink plenty of fluids. Follow up after 5 days.`,
      extractedData: {
        medicines: ['Paracetamol 500mg', 'Azithromycin 500mg', 'Vitamin C 500mg'],
        dosage: 'Paracetamol: TDS, Azithromycin: OD, Vit C: OD',
        duration: '5 days / 3 days / 10 days',
        notes: 'Rest, fluids. Follow up after 5 days.',
        dateOfReport: new Date('2025-08-25'),
        referredBy: 'Dr. S. Patel, MD'
      }
    },
    'Imaging': {
      ocrText: `CHEST X-RAY REPORT\nDate: 2025-08-22\nFindings: Normal cardiac silhouette. Both lung fields are clear. No obvious consolidation or pleural effusion seen.\nImpression: Normal chest X-ray. No acute cardiopulmonary pathology.`,
      extractedData: {
        imagingType: 'Chest X-Ray',
        findings: 'Normal cardiac silhouette. Clear lung fields. No consolidation.',
        impression: 'Normal chest X-ray. No acute cardiopulmonary pathology.',
        dateOfReport: new Date('2025-08-22'),
        referredBy: 'Radiology Dept'
      }
    }
  };
  
  const result = simulatedData[docType] || simulatedData['Lab Report'];
  
  await Document.findByIdAndUpdate(doc._id, {
    ocrText: result.ocrText,
    extractedData: result.extractedData,
    processingStatus: 'completed'
  });
}

module.exports = router;